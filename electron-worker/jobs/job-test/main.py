import time

print("Starting example training...")

for epoch in range(1, 6):
    print(f"Epoch {epoch}/5: training...")
    time.sleep(1)
    print(f"Epoch {epoch}: loss={(6-epoch)/5:.3f}, acc={epoch/5:.3f}")

print("Training complete!")

# Create output file
print("\nSaving model...")
with open("model.txt", "w") as f:
    f.write("Trained Model Data\n")
    f.write("Final accuracy: 1.000\n")
    f.write("Final loss: 0.200\n")

print("Model saved to model.txt")
