from flask import Flask, request, jsonify, render_template
from PIL import Image
import pytesseract
import pickle
import cv2
import numpy as np
import os
import platform

app = Flask(__name__)

if platform.system() == "Windows":
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

model = pickle.load(open(os.path.join(BASE_DIR, "phishing_model.pkl"), "rb"))
vectorizer = pickle.load(open(os.path.join(BASE_DIR, "vectorizer.pkl"), "rb"))

@app.route('/')
def home():
    return render_template('phishguard.html')


@app.route('/detect', methods=['POST'])
def detect():

    if 'file' in request.files:

        file = request.files['file']
        image = Image.open(file).convert("RGB")

        img = np.array(image)

        if img is None or img.size == 0:
            return jsonify({"error": "Invalid image"}), 400

        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        thresh = cv2.threshold(gray,150,255,cv2.THRESH_BINARY)[1]

        text = pytesseract.image_to_string(thresh)

    else:
        data = request.get_json()

        if not data or "text" not in data:
            return jsonify({"error": "No text provided"}), 400

        text = data["text"]

    data_vec = vectorizer.transform([text])
    prediction = model.predict(data_vec)[0]

    result = "Phishing Detected" if prediction == 1 else "Safe Email"

    return jsonify({
        "prediction": result,
        "extracted_text": text
    })


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)