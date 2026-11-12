# portfolio

Landing page portofolio aplikasi Iqbal Mantam: 20 aplikasi untuk asesmen psikometri, rekrutmen, analisis data, bisnis, logistik, dan tools kreatif.

Live: https://iqbalmantam.github.io/portfolio/

## Struktur

- `index.html`: halaman tunggal (Tailwind via CDN, ikon Lucide, font Plus Jakarta Sans). Daftar aplikasi ada di array `appsData`.
- `demo/rak-view/`, `demo/pic-racking/`, dan `demo/gudang-live/`: contoh untuk perusahaan logistik, **memakai data simulasi** (nama client, brand, PIC, dan lokasi fiktif).
- `og-image.png`: gambar pratinjau (1200x630) saat link dibagikan di WhatsApp, LinkedIn, dan media sosial lain.

## Menambah atau mengubah aplikasi

Edit array `appsData` di `index.html`. Setiap aplikasi punya field:

| Field | Keterangan |
| --- | --- |
| `id` | ID unik berupa string |
| `title`, `desc` | Nama dan deskripsi singkat di kartu |
| `category` | Kategori untuk tab filter (kategori baru otomatis muncul sebagai tab) |
| `url` | Alamat aplikasi |
| `icon` | Nama ikon dari [Lucide](https://lucide.dev/icons) |
| `status`, `techStack` | Label status dan daftar teknologi |
| `kegunaan`, `kelebihan`, `kemampuan` | Isi modal detail |

Perubahan yang di-push ke branch `main` otomatis tayang lewat GitHub Pages.
