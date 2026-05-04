# Cheng Yin Personal Homepage

Static bilingual personal homepage for `yincheng429.cn`, designed for GitHub Pages.

The page defaults to English and includes a top-right Chinese/English switch. It uses the `assets/life/` media files for the life/travel section; the raw `assets/personal-photo/` source folder is ignored by git. The Zhihu section summarizes public profile stats and pinned-note themes without copying long post bodies.

Profile copy highlights Ph.D. training across HUST, Tsinghua THUNLP, and Beijing Zhongguancun Academy. GitHub impact counts `OpenBMB/DeepThinkVLA` as Cheng Yin's repository after its transfer to OpenBMB, so total public GitHub stars are shown as 900+.

## Local preview

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## GitHub Pages deployment

Recommended repository: `wadeKeith.github.io`.

1. Push this directory to GitHub.
2. In GitHub, open `Settings -> Pages`.
3. Set source to `Deploy from a branch`, branch `main`, folder `/`.
4. Custom domain should read `yincheng429.cn`; the `CNAME` file already contains it.

## DNS records

In Aliyun DNS for `yincheng429.cn`, add these records for GitHub Pages:

| Host | Type | Value |
| --- | --- | --- |
| `@` | `A` | `185.199.108.153` |
| `@` | `A` | `185.199.109.153` |
| `@` | `A` | `185.199.110.153` |
| `@` | `A` | `185.199.111.153` |
| `www` | `CNAME` | `wadeKeith.github.io` |

After DNS resolves, enable `Enforce HTTPS` in GitHub Pages.

## Content sources

- GitHub: https://github.com/wadeKeith
- Google Scholar: https://scholar.google.com/citations?user=Qc0js-IAAAAJ&hl=en
- Project site: http://vision-intelligence-feishu-ai.top
- Hugging Face: https://huggingface.co/yinchenghust
- ModelScope: https://modelscope.cn/profile/keithyc
- Zhihu: https://www.zhihu.com/people/keith-80-24
