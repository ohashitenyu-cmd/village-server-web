# Village Server 公式サイト案

ARK:SA とパルワールドのコミュニティ「Village Server」の公式サイト案です。Beer CSS（Material Design 3）で作っています。

プロトタイプなので、ログインや申し込みは実際にはつながりません。操作した内容（ログイン・お気に入り・ルールの確認など）は、見ている人のブラウザにだけ保存されます。はじめの状態から見たいときは、シークレットウィンドウで開いてください。

## ファイル

- `src/village-server.src.html` … 編集するのはこのファイルです。
- `vendor/` … Beer CSS 5.0.3（MIT）、波形プログレス用の画像、チャットのアバター「ムギ」（mura-neko.js）。
- `build.ps1` … `src` と `vendor` から `village-server.html` と `index.html` を作ります。
- `village-server.html` … Claude のアーティファクトとして公開するページ（ビルド結果）。
- `index.html` … GitHub Pages で公開するページ（同じ中身に、HTML の頭の部分を付けたもの）。
- `img/` … ページで使う画像。マップの風景は ARK: Survival Ascended 公式の画像です。

## ビルド

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

## GitHub Pages

リポジトリの Settings → Pages で、Source を「Deploy from a branch」、Branch を `main` の `/ (root)` にすると、`index.html` がサイトとして公開されます。
