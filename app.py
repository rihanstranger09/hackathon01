from flask import Flask, request, jsonify
from PIL import Image
import pytesseract
import pickle
import cv2
import numpy as np


# Path to your image
image_path = "image.jpg"

# Read image
img = cv2.imread(image_path)

# Convert to grayscale (improves accuracy)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# OCR: extract text
text = pytesseract.image_to_string(gray)

# Print extracted text
print("Extracted Text:\n")
print(text)

# Save to txt file
with open("output.txt", "w") as file:
    file.write(text)

print("\nText saved to output.txt")

app = Flask(__name__)

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

model_path = os.path.join(BASE_DIR, "phishing_model.pkl")
vectorizer_path = os.path.join(BASE_DIR, "vectorizer.pkl")

model = pickle.load(open(model_path, "rb"))
vectorizer = pickle.load(open(vectorizer_path, "rb"))

@app.route('/detect', methods=['POST'])
def detect():

    if 'file' in request.files:

        file = request.files['file']
        image = Image.open(file)

        img = np.array(image)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        thresh = cv2.threshold(gray,150,255,cv2.THRESH_BINARY)[1]

        text = pytesseract.image_to_string(thresh)

    else:
        text = request.json['text']

    data = vectorizer.transform([text])
    prediction = model.predict(data)[0]

    result = "Phishing Detected" if prediction == 1 else "Safe Email"

    return jsonify({
        "prediction": result,
        "extracted_text": text
    })


if __name__ == '__main__':
    app.run(debug=True)