# 🛡️ PhishGuard AI – Intelligent Phishing Detection System

## 🚀 Overview

**PhishGuard AI** is a real-time phishing detection and prevention system built during a hackathon to combat one of the most common cybersecurity threats: phishing attacks.

Phishing attacks trick users into revealing sensitive information such as passwords, banking details, or personal data by impersonating trusted websites or services. PhishGuard AI helps prevent these attacks by analyzing suspicious URLs and screenshots using Artificial Intelligence, Machine Learning, and Optical Character Recognition (OCR).

The platform allows users to quickly check whether a link or message is potentially malicious, providing an accessible tool for improving online safety.

---

## ✨ Key Features

### 🔍 Real-Time URL Analysis

Users can submit suspicious URLs, and the system analyzes multiple features of the link to determine whether it is legitimate or phishing.

### 🖼️ OCR-Based Screenshot Detection

Users can upload screenshots of suspicious messages or websites. The system extracts text using OCR and analyzes it for phishing indicators.

### 🤖 AI/ML-Powered Classification

A trained machine learning model evaluates extracted features from URLs and classifies them as **safe** or **phishing**.

### 🌐 Interactive Web Interface

A simple and intuitive web interface allows users to easily paste URLs or upload screenshots for quick analysis.

### ⚡ Fast Backend Processing

The Flask-based backend processes requests efficiently and returns predictions in real time.

---

## 🏗️ Project Architecture

The system follows a client-server architecture designed for speed and simplicity.

**Frontend (User Interface)**

* Provides a simple webpage where users can enter URLs or upload images
* Displays phishing detection results

**Backend (Flask Server)**

* Receives user requests from the frontend
* Processes URLs and uploaded images
* Sends extracted data to the machine learning model

**Machine Learning Model**

* Trained using phishing and legitimate URL datasets
* Predicts whether a URL is safe or malicious

**OCR Engine**

* Extracts text from screenshots using Tesseract OCR
* Helps identify phishing patterns in messages and webpages

---

## 🧰 Technology Stack

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* Python 🐍
* Flask

### Machine Learning

* Scikit-learn
* Pickle (Model Serialization)

### Computer Vision & OCR

* OpenCV
* Tesseract OCR
* Pillow

### Deployment

* Render ☁️
* GitHub (Version Control)

---

## 📁 Project Structure

```
phishguard-ai/
│
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── build.sh               # Deployment build script
│
├── templates/
│   └── phishguard.html    # Frontend interface
│
├── model/
│   └── phishing_model.pkl # Trained ML model
│
└── static/
    ├── css
    ├── js
    └── images
```

---

## ⚙️ Installation and Setup

### 1️⃣ Clone the Repository

```
git clone https://github.com/yourusername/phishguard-ai.git
cd phishguard-ai
```

### 2️⃣ Install Dependencies

```
pip install -r requirements.txt
```

### 3️⃣ Run the Application

```
python app.py
```

The application will start locally at:

```
http://127.0.0.1:5000
```

---

## ☁️ Deployment (Render)

The project is deployed using **Render** for cloud hosting.

**Steps to deploy:**

1. Push the repository to GitHub
2. Connect the repository to Render
3. Set the build command:

```
pip install -r requirements.txt
```

4. Set the start command:

```
gunicorn app:app
```

Once deployed, the system becomes accessible via a public URL.

---

## 🔮 Future Improvements

* 🧩 Browser extension for real-time phishing detection
* 📧 Email phishing detection support
* 🧠 Deep learning models for improved accuracy
* 🌍 Integration with cybersecurity threat intelligence APIs
* 📊 Continuous dataset updates for better model training

---

## 👥 Team

**Team Name:** Code Breakers

Team Roles:

* Frontend Developer
* Backend Developer
* Machine Learning Engineer
* System Integration & Testing

---

## 🎯 Use Cases

PhishGuard AI can be useful for:

* 🧑‍🎓 Students learning cybersecurity concepts
* 🏢 Organizations wanting lightweight phishing detection tools
* 🔬 Security researchers experimenting with phishing detection models
* 🌐 Everyday users verifying suspicious links before clicking

---

## 📜 License

This project was developed for **educational and hackathon purposes**.
Feel free to explore, modify, and improve the system for learning and research.

---

⭐ If you found this project interesting, consider giving it a **star on GitHub**!
