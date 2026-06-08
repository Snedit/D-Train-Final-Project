import User from "../schemas/UserSchema.js";
import Transaction from "../schemas/TransactionSchema.js";
import Worker from "../schemas/WorkerSchema.js";
import Groq from "groq-sdk";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
//  TIER SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export const TIERS = [10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500];

export const PLATFORM_CUT = 0.20;
export const WORKER_CUT   = 0.80;

export const workerEarnings   = (tierPrice) => parseFloat((tierPrice * WORKER_CUT).toFixed(2));
export const platformEarnings = (tierPrice) => parseFloat((tierPrice * PLATFORM_CUT).toFixed(2));

export const hashRequirements = (text) =>
  crypto.createHash("sha256").update(text).digest("hex");

/**
 * scoreJobComplexity
 * Rule-based pre-scorer that analyses both files and returns a complexity
 * score 0-100. This runs BEFORE Groq and sets a floor so that genuinely
 * heavy jobs can never be under-priced just because Groq misreads them.
 *
 * FIX: Strip comment lines from requirements.txt before matching so that
 * a comment like "# Add things like: torch, tensorflow" doesn't falsely
 * trigger the deep-learning library weights.
 */
const scoreJobComplexity = (requirementsTxt, mainFileTxt) => {
  // Strip comment lines so "# torch" doesn't match torch
  const reqLines = requirementsTxt
    .split("\n")
    .filter(line => line.trim() && !line.trim().startsWith("#"))
    .join("\n")
    .toLowerCase();

  const code = mainFileTxt.toLowerCase();
  let score  = 0;

  // ── Library weights (only real package lines, no comments) ───────────────
  if (/^torch($|[>=<!\s])/m.test(reqLines) || /^pytorch/m.test(reqLines)) score += 40;
  if (/^tensorflow|^keras/m.test(reqLines))                                 score += 40;
  if (/^transformers|^diffusers/m.test(reqLines))                           score += 45;
  if (/^xgboost|^lightgbm|^catboost/m.test(reqLines))                       score += 20;
  if (/^scikit.learn|^sklearn/m.test(reqLines))                             score += 10;
  if (/^numpy|^pandas/m.test(reqLines))                                     score += 2;

  // ── Dataset size signals in code ──────────────────────────────────────────
  const sampleMatch = code.match(/n_samples\s*[=:,]\s*([\d_]+)/);
  if (sampleMatch) {
    const n = parseInt(sampleMatch[1].replace(/_/g, ""));
    if (n >= 100_000) score += 30;
    else if (n >= 50_000) score += 20;
    else if (n >= 10_000) score += 10;
    else if (n >= 1_000)  score += 5;
  }

  // ── Training complexity signals ───────────────────────────────────────────
  if (/gridsearchcv|randomizedsearchcv/.test(code))     score += 25;
  if (/stackingclassifier|votingclassifier/.test(code)) score += 20;
  if (/cross_val_score|stratifiedkfold|kfold/.test(code)) score += 15;
  if (/gradientboostingclassifier|gradientboostingregressor/.test(code)) score += 15;
  if (/randomforestclassifier|randomforestregressor/.test(code)) score += 10;
  if (/svc|svr/.test(code))                     score += 10;

  // n_estimators
  const estMatches = code.match(/n_estimators\s*[=:]\s*(\d+)/g);
  if (estMatches) {
    const maxE = Math.max(...estMatches.map(m => parseInt(m.match(/\d+/)[0])));
    if (maxE >= 300) score += 15;
    else if (maxE >= 100) score += 8;
  }

  // epochs
  const epochMatch = code.match(/epochs?\s*[=:]\s*(\d+)/);
  if (epochMatch) {
    const ep = parseInt(epochMatch[1]);
    if (ep >= 50) score += 20;
    else if (ep >= 10) score += 10;
    else if (ep >= 3)  score += 5;
  }

  // ── Neural network signals ────────────────────────────────────────────────
  if (/nn\.module|nn\.linear|conv2d|lstm|transformer/.test(code)) score += 35;
  if (/model\.fit|model\.train|optimizer\.step/.test(code))       score += 15;

  // ── Multiple models ───────────────────────────────────────────────────────
  const modelCount = (code.match(/classifier|regressor/g) || []).length;
  if (modelCount >= 4) score += 15;
  else if (modelCount >= 2) score += 8;

  return Math.min(score, 100);
};

/**
 * scoreToTierFloor
 * Maps a complexity score to a tier floor.
 * Groq can only go UP from this floor, never below.
 */
const scoreToTierFloor = (score) => {
  if (score >= 80) return 200;
  if (score >= 60) return 150;
  if (score >= 45) return 100;
  if (score >= 30) return 75;
  if (score >= 15) return 50;
  return 30;
};

export const assignTierWithGroq = async (requirementsTxt, mainFileTxt = "", entryFile = "main.py") => {
  try {
    // ── Step 1: Rule-based floor ──────────────────────────────────────────
    const complexityScore = scoreJobComplexity(requirementsTxt, mainFileTxt);
    const tierFloor       = scoreToTierFloor(complexityScore);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 Complexity score: ${complexityScore}/100 → floor tier: ₹${tierFloor}`);
    console.log(`📄 requirements.txt (${requirementsTxt.length} chars):\n${requirementsTxt.slice(0, 300)}`);
    console.log(`📄 ${entryFile} (${mainFileTxt.length} chars, first 300 chars):\n${mainFileTxt.slice(0, 300)}`);
    console.log(`${"=".repeat(60)}`);

    // ── Step 2: Groq gives its estimate ──────────────────────────────────
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const mainFilePreview = mainFileTxt
      ? mainFileTxt.slice(0, 3000) + (mainFileTxt.length > 3000 ? "\n... (truncated)" : "")
      : "(not provided)";

    const prompt = `
You are a compute cost estimator for a distributed ML training platform.
Read BOTH files below carefully, then pick the best matching tier from this exact list:
${TIERS.join(", ")}

TIER DECISION RULES — apply in order:

RULE 1 — Library check (requirements.txt):
- Contains torch/pytorch/tensorflow/keras/transformers/diffusers/cuda → minimum ₹200
- Contains xgboost/lightgbm/catboost → minimum ₹100
- Contains only scikit-learn/sklearn/numpy/pandas/scipy → maximum ₹150 (unless code is very heavy)
- Contains only stdlib (time, os, math, json) → ₹30

RULE 2 — Dataset size (look for n_samples=, len(dataset), shape, row counts in code):
- n_samples >= 100000 → add complexity score HIGH
- n_samples 10000–99999 → add complexity score MEDIUM
- n_samples < 10000 → add complexity score LOW

RULE 3 — Training complexity (look in the code file):
- Has GridSearchCV or RandomizedSearchCV → heavy (+2 tiers)
- Has StackingClassifier or VotingClassifier → heavy (+1 tier)
- Has cross_val_score or StratifiedKFold with cv >= 5 → medium (+1 tier)
- Has GradientBoostingClassifier or RandomForestClassifier → medium
- Has SVC/SVM → medium
- Multiple models trained → heavier
- Only one simple model (LinearRegression, DecisionTree) → light

RULE 4 — Neural network signals (code file):
- nn.Module, nn.Linear, Conv2d, LSTM, Transformer classes → ₹300+
- model.fit() on keras/tf → ₹200+
- epochs > 50 → ₹300+
- epochs 10–50 → ₹200+

FINAL EXAMPLES to calibrate:
- "import time; time.sleep(1)" → ₹30
- "LogisticRegression().fit(X, y)" with 1000 rows → ₹50
- "RandomForestClassifier(n_estimators=100)" with 5000 rows → ₹75
- "GridSearchCV(RandomForest, params, cv=5)" with 10000 rows → ₹100
- "GridSearchCV + StackingClassifier + cross_val_score, n_samples=50000" → ₹150
- "torch nn.Linear + epochs=10" → ₹200
- "transformers BERT fine-tuning" → ₹400

=== requirements.txt ===
${requirementsTxt}

=== ${entryFile} (training script) ===
${mainFilePreview}

Reply with ONE integer from this list only: ${TIERS.join(", ")}
No explanation. No currency symbol. Just the number.
`.trim();

    const chat = await client.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
      temperature: 0,
    });

    const raw    = chat.choices[0]?.message?.content?.trim() ?? "";
    console.log(`🤖 Groq raw response: "${raw}"`);
    const parsed = parseInt(raw, 10);

    let groqTier;
    if (TIERS.includes(parsed)) {
      groqTier = parsed;
    } else {
      groqTier = TIERS.reduce((prev, curr) =>
        Math.abs(curr - parsed) < Math.abs(prev - parsed) ? curr : prev
      );
    }

    // ── Step 3: Take the MAX of rule-based floor and Groq estimate ────────
    // This guarantees heavy jobs are never under-priced even if Groq is wrong
    const finalTier = Math.max(tierFloor, groqTier);
    console.log(`🤖 Groq tier: ₹${groqTier} | Rule floor: ₹${tierFloor} | ✅ Final: ₹${finalTier}`);
    console.log(`${"=".repeat(60)}\n`);

    return finalTier;
  } catch (err) {
    console.error("Groq tier assignment failed — using rule-based score only:", err.message);
    const complexityScore = scoreJobComplexity(requirementsTxt, mainFileTxt);
    return scoreToTierFloor(complexityScore);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  WALLET HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const getAvailableBalance = (user) =>
  parseFloat(Math.max(0, (user.walletBalance ?? 0) - (user.reservedBalance ?? 0)).toFixed(2));

export const validateSufficientBalance = async (userId, amount) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { sufficient: false, error: "User not found" };
    const available = getAvailableBalance(user);
    return {
      sufficient: available >= amount,
      balance:    user.walletBalance,
      reserved:   user.reservedBalance ?? 0,
      available,
    };
  } catch (error) {
    return { sufficient: false, error: error.message };
  }
};

export const reserveFunds = async (userId, amount, jobId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, error: "User not found" };
    const available = getAvailableBalance(user);
    if (available < amount) {
      return {
        success: false,
        error: `Insufficient available balance. Need ₹${amount}, available ₹${available}`,
        required: amount, available,
      };
    }
    user.reservedBalance = parseFloat(((user.reservedBalance ?? 0) + amount).toFixed(2));
    await user.save();
    await Transaction.create({
      userId, type: "reservation", amount, status: "completed", jobId,
      description: `Reserved ₹${amount} for job (tier fee)`,
    });
    return { success: true, newReserved: user.reservedBalance, availableBalance: getAvailableBalance(user) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const releaseReservation = async (userId, amount, jobId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, error: "User not found" };
    user.reservedBalance = parseFloat(Math.max(0, (user.reservedBalance ?? 0) - amount).toFixed(2));
    await user.save();
    await Transaction.create({
      userId, type: "refund", amount, status: "completed", jobId,
      description: `Released ₹${amount} reservation (job cancelled/failed)`,
    });
    return { success: true, availableBalance: getAvailableBalance(user) };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const chargeFunds = async (userId, tierPrice, jobId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, error: "User not found" };
    if (user.walletBalance < tierPrice) {
      return {
        success: false,
        error: `Insufficient wallet balance. Required ₹${tierPrice}, available ₹${user.walletBalance.toFixed(2)}`,
        required: tierPrice, available: user.walletBalance,
      };
    }
    user.walletBalance   = parseFloat((user.walletBalance - tierPrice).toFixed(2));
    user.reservedBalance = parseFloat(Math.max(0, (user.reservedBalance ?? 0) - tierPrice).toFixed(2));
    await user.save();
    const transaction = await Transaction.create({
      userId, type: "charge", amount: tierPrice, status: "completed", jobId,
      description: `Charged ₹${tierPrice} (tier fee) for completed job`,
    });
    return { success: true, transaction, newBalance: user.walletBalance };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const creditWorkerWallet = async (workerId, workerAmount, jobId) => {
  try {
    const worker = await Worker.findById(workerId);
    if (!worker) return { success: false, error: "Worker not found" };
    worker.walletBalance   = parseFloat((worker.walletBalance   + workerAmount).toFixed(2));
    worker.totalEarnings   = parseFloat((worker.totalEarnings   + workerAmount).toFixed(2));
    worker.pendingEarnings = Math.max(0, parseFloat((worker.pendingEarnings - workerAmount).toFixed(2)));
    await worker.save();
    const transaction = await Transaction.create({
      userId: worker.userId, workerId: worker._id, type: "worker_payout",
      amount: workerAmount, status: "completed", jobId,
      description: `Earned ₹${workerAmount} (80% of tier) for completed job`,
    });
    return { success: true, transaction, newBalance: worker.walletBalance };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const addFundsToWallet = async (userId, amount, stripeSessionId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, error: "User not found" };
    user.walletBalance = parseFloat((user.walletBalance + amount).toFixed(2));
    await user.save();
    let transaction = await Transaction.findOneAndUpdate(
      { "metadata.stripeSessionId": stripeSessionId, status: "pending" },
      { status: "completed", description: `Wallet top-up of ₹${amount.toFixed(2)}` },
      { new: true }
    );
    if (!transaction) {
      transaction = await Transaction.create({
        userId, type: "topup", amount, status: "completed",
        description: `Wallet top-up of ₹${amount.toFixed(2)}`,
        metadata: { stripeSessionId },
      });
    }
    return { success: true, transaction, newBalance: user.walletBalance };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getElapsedSeconds = (startTime) =>
  Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);