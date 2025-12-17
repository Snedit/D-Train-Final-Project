import jwt from "jsonwebtoken";

function signPayload(payload, expiresIn='7d')
{
    const secret = process.env.JWT_SECRET;

    const token = jwt.sign(
        payload,  // ✅ CORRECT - pass payload directly
        secret,
        {expiresIn: expiresIn}
    )
    return token;
}

export {signPayload};
