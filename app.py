import streamlit as st
import pickle
import re
import plotly.express as px
import random

# PAGE CONFIG
st.set_page_config(page_title="AI Phishing Detector", page_icon="🛡️", layout="wide")

# LOAD MODEL + VECTORIZER (cached for speed)
@st.cache_resource
def load_models():
    model = pickle.load(open("phishing_model.pkl", "rb"))
    vectorizer = pickle.load(open("vectorizer.pkl", "rb"))
    return model, vectorizer

model, vectorizer = load_models()

# HELPER FUNCTIONS
suspicious_keywords = [
    "click","urgent","password","verify","login","congratulations",
    "account","suspended","winner","bank","security","confirm","blocked"
]

def highlight_suspicious(text):
    return [w for w in suspicious_keywords if w in text.lower()]

def domain_analysis(text):
    url_pattern = r"(https?://[^\s]+)"
    urls = re.findall(url_pattern, text.lower())
    flagged = []

    for u in urls:
        if any(keyword in u for keyword in ["login","secure","verify"]):
            if not any(safe in u for safe in ["microsoft.com","amazon","google","apple.com","bankofindia.co.in"]):
                flagged.append(u)

    return urls, flagged


def predict_text(text):
    features = vectorizer.transform([text])
    proba = model.predict_proba(features)[0]

    phishing_prob = float(proba[1]) * 100
    safe_prob = float(proba[0]) * 100

    trusted_domains = [
        "amazon.com","amazon.in","apple.com",
        "microsoft.com","google.com","bankofindia.co.in"
    ]

    for domain in trusted_domains:
        if domain in text.lower():
            return "safe", phishing_prob, safe_prob + 20

    if phishing_prob >= 75:
        label = "phishing"
    elif phishing_prob >= 45:
        label = "suspicious"
    else:
        label = "safe"

    return label, phishing_prob, safe_prob


# SESSION STATE
if "history" not in st.session_state:
    st.session_state["history"] = {"phishing":0, "suspicious":0, "safe":0}


# SIDEBAR
st.sidebar.image(
    "https://img.icons8.com/color/96/000000/security-checked.png",
    width=120
)

st.sidebar.markdown("### 🧭 App Navigation")

menu = st.sidebar.radio(
    "",
    ["🛡️ Detector", "📊 Dashboard", "💡 Awareness & Quiz"]
)

theme_choice = st.sidebar.radio(
    "🎨 Theme Mode:",
    ["🌞 Light Mode","🌙 Dark Mode"]
)


# ======================== DETECTOR ==========================
if menu == "🛡️ Detector":

    st.title("🛡️ Real-Time Phishing Detection & Prevention")

    user_input = st.text_area("✍️ Paste any email text or URL:")

    uploaded = st.file_uploader(
        "📂 Or upload a .txt email file:",
        type=["txt"]
    )

    if uploaded:
        user_input = uploaded.read().decode("utf-8")

        st.info("📄 File uploaded! Preview:")
        st.code(user_input[:400])

    if st.button("🔍 Run Detection"):

        if user_input.strip():

            label, phishing_prob, safe_prob = predict_text(user_input)

            st.session_state["history"][label] += 1

            if label == "phishing":

                st.error(
                    f"🚨 PHISHING DETECTED\n\n"
                    f"Phishing Probability: {phishing_prob:.2f}%"
                )

            elif label == "suspicious":

                st.warning(
                    f"⚠️ Suspicious Content\n\n"
                    f"Phishing Probability: {phishing_prob:.2f}%"
                )

            else:

                st.success(
                    f"✅ Safe Content\n\n"
                    f"Safe Probability: {safe_prob:.2f}%"
                )

                st.balloons()

            words = highlight_suspicious(user_input)

            if words:
                st.warning("⚠️ Suspicious Keywords: " + ", ".join(words))

            urls, flagged = domain_analysis(user_input)

            if urls:

                st.subheader("🔗 URL Analysis")

                for u in urls:

                    if u in flagged:
                        st.error(f"{u} → 🚨 Suspicious/Fake Domain")

                    else:
                        st.success(f"{u} → ✅ Trusted Domain")

        else:

            st.warning("⚠️ Please enter text or upload a file.")


# ======================== DASHBOARD =========================
elif menu == "📊 Dashboard":

    st.title("📊 Detection Dashboard")

    total = sum(st.session_state["history"].values())

    if total == 0:

        st.info("No scans yet. Run the Detector first.")

    else:

        col1, col2, col3 = st.columns(3)

        col1.metric("🚨 Phishing", st.session_state["history"]["phishing"])
        col2.metric("⚠️ Suspicious", st.session_state["history"]["suspicious"])
        col3.metric("✅ Safe", st.session_state["history"]["safe"])

        data = st.session_state["history"]

        labels = [k for k,v in data.items() if v>0]
        values = [v for v in data.values() if v>0]

        fig = px.pie(
            values=values,
            names=labels,
            hole=0.4
        )

        st.plotly_chart(fig)

        st.bar_chart(data)


# ======================== QUIZ ===============================
elif menu == "💡 Awareness & Quiz":

    st.title("💡 Phishing Awareness & Quiz")

    st.subheader("✅ Safety Tips")

    st.markdown(
    """
    - Verify sender email carefully  
    - Hover links before clicking  
    - Ignore urgency scams  
    - Never share OTP/password  
    - Type official sites manually
    """
    )

    st.subheader("🎮 Awareness Quiz")

    question_bank = [

        {"q":"Your PayPal account is limited, click to verify.",
         "options":["Legit","Phishing"],"answer":"Phishing"},

        {"q":"Domain amazon-verification.net",
         "options":["Safe","Phishing"],"answer":"Phishing"},

        {"q":"Congratulations! You won a lottery.",
         "options":["Safe","Phishing"],"answer":"Phishing"},

        {"q":"Email from support@apple.com reset password",
         "options":["Safe","Phishing"],"answer":"Safe"},

        {"q":"Link https://www.bankofindia.co.in/account/login",
         "options":["Safe","Phishing"],"answer":"Safe"}
    ]

    quiz_questions = random.sample(question_bank, 5)

    score = 0

    for i, q in enumerate(quiz_questions):

        user_answer = st.radio(q["q"], q["options"], key=f"quiz{i}")

        if user_answer == q["answer"]:
            score += 1
            st.success("Correct")

        elif user_answer:
            st.error("Incorrect")

    st.subheader(f"🏆 Final Score: {score}/5")

    if score == 5:
        st.balloons()