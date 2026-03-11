from flask import Flask, request, jsonify
from PIL import Image
import pytesseract
import pickle
import cv2
import numpy as np
import os

app = Flask(__name__)

# Load OCR engine
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

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
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)