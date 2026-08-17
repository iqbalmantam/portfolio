import streamlit as st
import pandas as pd
import hashlib

# --- Konfigurasi Halaman ---
st.set_page_config(
    page_title="Mantam Talent Analytics (Demo SaaS)",
    page_icon="💼",
    layout="wide"
)

# --- FUNGSI AUTENTIKASI SEDERHANA ---
# Dalam produksi nyata, gunakan database (PostgreSQL/Firebase) atau streamlit-authenticator.
# Ini adalah simulasi sederhana untuk menunjukkan konsep paywall/login.

USER_CREDENTIALS = {
    # format: username: password_hash
    "hr_demo": hashlib.sha256("demo123".encode()).hexdigest(),
    "perusahaan_a": hashlib.sha256("rahasia123".encode()).hexdigest()
}

USER_TIERS = {
    "hr_demo": "Free Trial",
    "perusahaan_a": "Pro / Enterprise"
}

def verify_login(username, password):
    if username in USER_CREDENTIALS:
        if USER_CREDENTIALS[username] == hashlib.sha256(password.encode()).hexdigest():
            return True
    return False

# --- SESSION STATE INISIALISASI ---
if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False
if 'username' not in st.session_state:
    st.session_state.username = ""

# --- HALAMAN LOGIN (PAYWALL WALL) ---
if not st.session_state.logged_in:
    st.title("💼 Mantam Talent Analytics")
    st.subheader("Platform Rekrutmen AI Terpadu (SaaS B2B)")
    st.markdown("---")
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.info("👋 **Selamat datang!** Ini adalah contoh penguncian aplikasi portofolio Anda menjadi layanan berbayar (SaaS).")
        st.markdown('''
        **Fitur Premium:**
        *   🤖 Asisten Wawancara AI Otomatis
        *   🧠 Alat Tes Psikometri Kustom
        *   📊 Dashboard Pengelolaan Data Kandidat
        ''')
        
        st.markdown("*(Gunakan username: **hr_demo**, password: **demo123** untuk masuk)*")
        
    with col2:
        with st.form("login_form"):
            st.write("### Masuk ke Akun Perusahaan Anda")
            input_user = st.text_input("Username")
            input_pass = st.text_input("Password", type="password")
            submitted = st.form_submit_button("Login")
            
            if submitted:
                if verify_login(input_user, input_pass):
                    st.session_state.logged_in = True
                    st.session_state.username = input_user
                    st.rerun()
                else:
                    st.error("Username atau password salah!")

# --- HALAMAN UTAMA (SETELAH LOGIN) ---
else:
    # Sidebar untuk Navigasi & Info Akun
    with st.sidebar:
        st.title("⚙️ Dashboard HR")
        st.write(f"Selamat datang, **{st.session_state.username}**!")
        
        tier = USER_TIERS.get(st.session_state.username, "Unknown")
        if tier == "Pro / Enterprise":
            st.success(f"Paket Anda: {tier}")
        else:
            st.warning(f"Paket Anda: {tier}")
            st.button("Upgrade ke Pro Sekarang ⭐")
            
        st.markdown("---")
        menu = st.radio(
            "Navigasi Aplikasi:",
            ("1. Dashboard Analitik", "2. Tes Psikometri", "3. Asisten Wawancara AI")
        )
        st.markdown("---")
        
        if st.button("Logout"):
            st.session_state.logged_in = False
            st.session_state.username = ""
            st.rerun()

    # Konten Berdasarkan Menu
    if menu == "1. Dashboard Analitik":
        st.header("📊 Dashboard Pengelolaan Data Kandidat")
        st.write("Ini adalah integrasi dari **Sistem Pengelolaan Data** yang Anda buat sebelumnya.")
        
        # Contoh dummy data
        df = pd.DataFrame({
            'Nama Kandidat': ['Budi Santoso', 'Siti Aminah', 'Andi Wijaya'],
            'Posisi': ['Software Engineer', 'Marketing', 'Data Analyst'],
            'Skor Psikometri': [85, 92, 78],
            'Skor Wawancara AI': [88, 90, 82],
            'Status': ['Lolos', 'Lolos', 'Review']
        })
        st.dataframe(df, use_container_width=True)
        
    elif menu == "2. Tes Psikometri":
        st.header("🧠 Alat Tes Psikometri")
        st.write("Di sinilah aplikasi tes Anda berjalan secara eksklusif untuk klien/perusahaan.")
        if USER_TIERS.get(st.session_state.username) == "Free Trial":
            st.info("ℹ️ Anda menggunakan paket Gratis. Anda hanya dapat mengetes 2 kandidat lagi bulan ini.")
        
        st.button("Mulai Sesi Tes Baru")
        
    elif menu == "3. Asisten Wawancara AI":
        st.header("🤖 Asisten Wawancara Berbasis AI")
        if USER_TIERS.get(st.session_state.username) == "Free Trial":
            st.error("🔒 Fitur Asisten Wawancara AI Penuh hanya tersedia untuk paket Pro / Enterprise.")
            st.button("Upgrade Sekarang untuk Membuka Fitur")
        else:
            st.write("Di sinilah modul AI wawancara interaktif Anda diaktifkan untuk klien.")
            st.text_area("Masukkan prompt wawancara untuk kandidat:", placeholder="Simulasikan wawancara teknis untuk posisi Python Developer...")
            st.button("Mulai Wawancara AI")
