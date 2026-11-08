// Otak asisten: memahami pertanyaan (Bahasa Indonesia/Inggris sederhana) dan memilih aplikasi
// dari array appsData. Murni JavaScript tanpa dependensi, jadi tetap jalan walau model 3D gagal dimuat.

const STOP = new Set((
  'yang untuk apa ada dan di ke dari saya aku mau bisa tolong dong ya kah itu ini dengan atau dalam pada oleh adalah ' +
  'akan agar juga lebih sebuah suatu para kak bang mas mbak sih deh nih lah kok kan apakah bagaimana gimana seperti ' +
  'buat bikin ingin pengen pingin butuh perlu punya kamu anda dia mereka kita kami cari carikan cariin tampilkan ' +
  'tunjukkan tunjukin kasih berikan beri lihat info informasi tentang soal mengenai aplikasi aplikasinya app apps ' +
  'tool tools yg utk dgn gak nggak tidak ga the an of to is are for me my you your with or can do does what which how ' +
  'i need want looking find show please jelaskan jelasin lanjut selengkapnya detail buka kunjungi tautan link coba'
).split(' '));

// Sinonim/kata kunci tambahan per aplikasi (kunci = judul huruf kecil). Aplikasi baru tetap bisa
// ditemukan lewat judul, deskripsi, kategori, dan tech stack walau belum punya tag di sini.
const TAGS = {
  'aplikasi bisnis': 'hr sdm hrd payroll gaji absensi cuti akuntansi keuangan pembukuan jurnal pajak crm penjualan sales marketing aset inventaris media sosial konten desktop windows suite umkm toko usaha harga beli',
  'irt test': 'psikometri irt cat adaptif tes ujian soal kemampuan kognitif psikotes asesmen theta',
  'test kandidat logistik': 'logistik gudang supply chain rekrutmen seleksi kandidat tes lamaran hiring operator karyawan',
  'test kepribadian': 'kepribadian big five ocean psikologi motivasi stres resiliensi karakter personality psikotes',
  'smart ai excel summarizer': 'excel spreadsheet csv data analisis chat tabel rumus laporan chart grafik ai',
  'smart cv screener': 'cv resume pelamar rekrutmen seleksi screening hiring kandidat lamaran hr karyawan recruiter',
  'ai interview assistant': 'wawancara interview rekrutmen google sheets pertanyaan penilaian hr hiring',
  'denah 3d studio': 'denah rumah kantor gudang toko desain interior arsitektur ruangan layout 3d glb furnitur',
  'baca buku': 'buku jurnal literatur skripsi referensi bacaan perpustakaan riset akademik tesis',
  'repo search': 'github repositori repository open source kode developer coding programmer',
  'studio editor': 'video edit editor reels tiktok youtube instagram konten kreator subtitle caption musik',
  'berita terkini': 'berita news kabar terkini informasi headline',
  'logistics news': 'berita news logistik supply chain pergudangan industri',
  "devil's advocate": 'strategi bisnis ide risiko pre-mortem kritik kegagalan startup rencana proyek analisis',
  'kartu remi': 'game permainan kartu remi poker hiburan main bot online multiplayer foto'
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function stem(w) {
  if (w.length <= 4) return w;
  let s = w.replace(/(nya|lah|kah|pun)$/, '');
  if (s.length > 5) s = s.replace(/(kan|an|i)$/, '');
  const p = s.replace(/^(meng|meny|mem|men|peng|pen|pem|ber|ter|me|pe|di|ke|se)/, '');
  return p.length >= 4 ? p : s;
}

const tokens = (text) => norm(text).split(' ').filter((t) => t && !STOP.has(t) && (t.length > 1)).map(stem);

function tokMatch(q, d) {
  if (q === d) return 1;
  if (q.length >= 4 && d.length >= 4 && (d.startsWith(q) || q.startsWith(d))) return 0.75;
  return 0;
}

const rx = (words) => new RegExp('(^|\\s)(' + words + ')(\\s|$)');
const has = (n, re) => re.test(n);

const GREET = rx('halo|hallo|hai|hi|hello|hey|hei|p|assalamualaikum|salam|permisi|selamat (pagi|siang|sore|malam)');
const THANKS = rx('makasih|terima kasih|thanks|thank you|thx|tengkyu|trims|suwun');
const BYE = rx('dadah|bye|sampai jumpa|daa|dah dulu|pamit');
const WHO = rx('kamu siapa|siapa kamu|siapa nama|namamu|nama kamu|kamu itu apa|kamu bisa apa|bisa apa|fungsimu|kamu ngapain|who are you|what can you do');
const OWNER = rx('siapa iqbal|siapa pembuat|pembuat|pembuatnya|developer|dibuat oleh|dibuat siapa|creator|pemilik|tentang iqbal|iqbal mantam');
const CONTACT = rx('kontak|hubungi|whatsapp|wa|telepon|telpon|nomor|kerja sama|kerjasama|order|pesan|harga|tarif|biaya|bayar|beli|berapa harga|contact|hire');
const LISTALL = rx('semua|daftar|list|berapa aplikasi|jumlah|ada apa saja|apa saja|punya apa|kategori');
const RECO = rx('rekomendasi|rekomendasikan|saran|terbaik|favorit|populer|unggulan|paling bagus|best|recommend');
const DETAIL = rx('detail|lebih lanjut|jelaskan|jelasin|selengkapnya|kelebihan|fitur|kemampuan|fungsi|kegunaan|apa itu|cara kerja|gimana cara|bagaimana cara');
const OPEN = rx('buka|open|link|tautan|kunjungi|pergi ke|ke sana|coba');
const AI_Q = rx('ai|kecerdasan buatan|llm|gpt|gemini|openai|chatbot');

const COMMANDS = [
  [rx('loncat|lompat|jump|melompat|meloncat'), 'jump', 'Hup! Gimana, tinggi nggak lompatanku?'],
  [rx('putar|muter|berputar|spin|pirouette|menari|joget|dance'), 'spin', 'Taraa! Muter dulu ya~'],
  [rx('lambai|lambaikan|salam tangan|wave'), 'wave', 'Halo halo! Ini lambaianku.'],
  [rx('senyum|tersenyum|smile|ketawa|tertawa'), 'smile', 'Hehe, senyum dulu. Manis kan?'],
  [rx('jalan|berjalan|keliling|walk|jalan jalan|jalan-jalan'), 'walk', 'Oke, aku jalan-jalan sebentar. Tetap bisa tanya sambil lihat aku keliling ya.'],
  [rx('hormat|membungkuk|bungkuk|bow'), 'bow', 'Terima kasih sudah mampir, silakan lihat-lihat.'],
  [rx('mikir|berpikir|think'), 'think', 'Hmm, sebentar, lagi mikir dulu...']
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

function trimText(s, max = 170) {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return (dot > 60 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…');
}

export function createBrain(apps, options = {}) {
  const ownerName = options.ownerName || 'Iqbal Mantam';
  const contactUrl = options.contactUrl || '';
  const N = apps.length;

  const docs = apps.map((app) => {
    const isAI = /ai/i.test(app.status || '') || (app.techStack || []).some((t) => /openai|gemini|llm|ai/i.test(t));
    const fields = [
      [5, app.title], [4, TAGS[norm(app.title)] || ''], [3, (app.techStack || []).join(' ')],
      [3, app.category], [2, app.desc], [1, [app.kegunaan, app.kelebihan, ...(app.kemampuan || [])].join(' ')],
      [3, isAI ? 'ai llm' : '']
    ].map(([w, text]) => ({ w, toks: new Set(tokens(text)) }));
    return { app, fields, isAI };
  });

  // IDF kasar: kata yang muncul di banyak aplikasi bobotnya lebih kecil.
  const df = new Map();
  docs.forEach((d) => {
    const seen = new Set();
    d.fields.forEach((f) => f.toks.forEach((t) => seen.add(t)));
    seen.forEach((t) => df.set(t, (df.get(t) || 0) + 1));
  });
  const idf = (t) => Math.log(1 + N / (df.get(t) || 1));

  function search(query) {
    const q = tokens(query);
    if (!q.length) return [];
    const nq = norm(query);
    const scored = docs.map((d) => {
      let score = 0;
      let hit = 0;
      q.forEach((qt) => {
        let best = 0;
        d.fields.forEach((f) => {
          f.toks.forEach((dt) => {
            const m = tokMatch(qt, dt);
            if (m) best = Math.max(best, m * f.w);
          });
        });
        if (best) { hit += 1; score += best * Math.max(0.6, idf(qt)); }
      });
      if (nq.length > 3 && norm(d.app.title).includes(nq)) score += 8;
      if (hit && hit === q.length) score *= 1.2;
      return { app: d.app, score };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) return [];
    const top = scored[0].score;
    return scored.filter((r) => r.score >= Math.max(2.2, top * 0.42));
  }

  const byTitle = (t) => apps.find((a) => norm(a.title) === norm(t));
  const reply = (r) => Object.assign({ mood: 'smile', act: null, apps: [], chips: [], filter: false }, r);
  const dayPart = () => {
    const h = new Date().getHours();
    return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
  };

  function describe(app, long) {
    if (!long) return trimText(app.desc, 160);
    const feats = (app.kemampuan || []).slice(0, 2).map((k) => trimText(k, 90)).join('; ');
    return trimText(app.kegunaan, 170) + (feats ? ' Fiturnya antara lain: ' + feats + '.' : '');
  }

  function answerForApps(found, long) {
    const top = found[0].app;
    const ids = found.map((f) => f.app.id);
    if (found.length === 1 || found[0].score > found[1].score * 2.2) {
      const extra = found.length > 1 ? ' Ada juga ' + (found.length - 1) + ' aplikasi lain yang agak mirip, lihat di bawah ya.' : '';
      const body = long ? describe(top, true) : describe(top) + ' ' + trimText(top.kelebihan, 110);
      return reply({
        text: 'Untuk itu, cocoknya "' + top.title + '". ' + body + extra,
        mood: 'joy', act: found.length > 1 ? 'nod' : 'jump', apps: ids, filter: true, openId: top.id
      });
    }
    const names = found.slice(0, 4).map((f) => '"' + f.app.title + '"').join(', ');
    return reply({
      text: 'Ada ' + found.length + ' aplikasi yang cocok: ' + names + (found.length > 4 ? ', dan lainnya' : '') +
        '. Yang paling pas menurut saya "' + top.title + '": ' + describe(top),
      mood: 'joy', act: 'nod', apps: ids, filter: true, openId: top.id
    });
  }

  function ask(text, ctx = {}) {
    const raw = String(text || '').trim();
    const n = norm(raw);
    if (!n) {
      return reply({ text: pick(['Ketik dulu pertanyaannya ya, nanti saya bantu carikan.', 'Hmm, kolomnya masih kosong nih. Coba tanya "aplikasi untuk rekrutmen".']), mood: 'smile', act: 'nod' });
    }

    for (const [re, act, line] of COMMANDS) {
      if (has(n, re) && n.split(' ').length <= 6) return reply({ text: line, mood: 'joy', act, commandOnly: true });
    }
    if (has(n, THANKS)) return reply({ text: pick(['Sama-sama! Kalau ada yang mau ditanyakan lagi, saya di sini.', 'Dengan senang hati! Silakan lanjut jelajahi aplikasinya.']), mood: 'joy', act: 'bow' });
    if (has(n, BYE)) return reply({ text: 'Sampai jumpa! Kapan-kapan mampir lagi ya.', mood: 'smile', act: 'wave' });
    if (has(n, WHO)) {
      return reply({
        text: 'Saya asisten virtual di portofolio ' + ownerName + '. Saya bisa mencarikan aplikasi dari ' + N + ' koleksi di sini, menjelaskan kegunaannya, dan menunjukkan cara menghubungi ' + ownerName + '. Coba tanya: "aplikasi untuk rekrutmen".',
        mood: 'joy', act: 'wave'
      });
    }
    if (has(n, OWNER) && !tokens(raw).some((t) => docs.some((d) => d.fields[0].toks.has(t)))) {
      return reply({
        text: 'Portofolio ini dikurasi dan dikembangkan oleh ' + ownerName + ': ' + N + ' aplikasi di bidang AI, analytics, dan psychometrics, mulai dari asesmen, rekrutmen, analisis data, bisnis, sampai tools kreatif.',
        mood: 'smile', act: 'bow', chips: contactUrl ? [{ label: 'Hubungi via WhatsApp', href: contactUrl }] : []
      });
    }
    if (has(n, CONTACT)) {
      return reply({
        text: 'Untuk harga, pemesanan, atau kerja sama, langsung hubungi ' + ownerName + ' lewat WhatsApp ya. Untuk "Aplikasi Bisnis", sistemnya sekali bayar tanpa langganan.',
        mood: 'smile', act: 'nod', chips: contactUrl ? [{ label: 'Chat WhatsApp', href: contactUrl }] : []
      });
    }
    if (has(n, GREET) && n.split(' ').length <= 5) {
      return reply({
        text: dayPart() + '! Saya asisten virtual ' + ownerName + '. Mau cari aplikasi apa hari ini? Misalnya "tes kepribadian", "edit video", atau "analisis Excel".',
        mood: 'joy', act: 'wave'
      });
    }
    if (has(n, LISTALL) && tokens(raw).length <= 2) {
      const cats = {};
      apps.forEach((a) => { cats[a.category] = (cats[a.category] || 0) + 1; });
      const list = Object.entries(cats).map(([c, k]) => c + ' (' + k + ')').join(', ');
      return reply({ text: 'Ada ' + N + ' aplikasi dalam ' + Object.keys(cats).length + ' kategori: ' + list + '. Kategori mana yang mau dilihat?', mood: 'smile', act: 'nod', apps: apps.map((a) => a.id), filter: false, categories: Object.keys(cats) });
    }
    if (has(n, RECO) && tokens(raw).length <= 2) {
      const picks = ['Smart CV Screener', 'IRT Test', 'Smart AI Excel Summarizer', 'Denah 3D Studio'].map(byTitle).filter(Boolean);
      return reply({
        text: 'Kalau baru mulai, saya sarankan ' + picks.map((p) => '"' + p.title + '"').join(', ') + '. Semuanya paling sering jadi favorit untuk dicoba.',
        mood: 'joy', act: 'jump', apps: picks.map((p) => p.id), filter: true, openId: picks[0] && picks[0].id
      });
    }

    const found = search(raw);
    const wantsDetail = has(n, DETAIL);
    const onlyCue = tokens(raw).length === 0 || (tokens(raw).length <= 1 && (has(n, DETAIL) || has(n, OPEN)));

    if ((onlyCue || (!found.length && (wantsDetail || has(n, OPEN)))) && ctx.lastAppId) {
      const app = apps.find((a) => a.id === ctx.lastAppId);
      if (app) {
        if (has(n, OPEN) && !wantsDetail) return reply({ text: 'Siap! Klik "Buka aplikasi" di bawah untuk membuka "' + app.title + '" di tab baru.', mood: 'joy', act: 'nod', apps: [app.id], filter: true, openId: app.id });
        return reply({ text: describe(app, true) + ' Kelebihannya: ' + trimText(app.kelebihan, 150), mood: 'joy', act: 'nod', apps: [app.id], filter: true, openId: app.id });
      }
    }

    if (has(n, AI_Q) && tokens(raw).length <= 2) {
      const ai = docs.filter((d) => d.isAI).map((d) => d.app);
      if (ai.length) return reply({ text: 'Ada ' + ai.length + ' aplikasi berbasis AI: ' + ai.slice(0, 4).map((a) => '"' + a.title + '"').join(', ') + (ai.length > 4 ? ', dan lainnya' : '') + '.', mood: 'joy', act: 'jump', apps: ai.map((a) => a.id), filter: true, openId: ai[0].id });
    }

    if (found.length) return answerForApps(found, wantsDetail);

    if (has(n, GREET)) return reply({ text: dayPart() + '! Ada yang bisa saya bantu carikan?', mood: 'joy', act: 'wave' });

    return reply({
      text: 'Hmm, saya belum menemukan aplikasi yang cocok dengan "' + trimText(raw, 40) + '". Coba kata kunci lain seperti "rekrutmen", "psikotes", "edit video", atau "analisis data". Atau tanyakan langsung ke ' + ownerName + '.',
      mood: 'sorry', act: 'think', chips: contactUrl ? [{ label: 'Tanya via WhatsApp', href: contactUrl }] : [], notFound: true
    });
  }

  function suggestions() {
    return ['Aplikasi untuk rekrutmen', 'Tes kepribadian', 'Yang berbasis AI', 'Edit video', 'Rekomendasi', 'Hubungi Iqbal'];
  }

  return { ask, search, suggestions, greeting: () => dayPart() + '! Saya asisten virtual ' + ownerName + '. Tanya saja, misalnya "aplikasi untuk rekrutmen". Saya juga suka jalan-jalan, jadi jangan kaget ya.' };
}
