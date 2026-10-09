# Village Server 公式サイト案

ARK:SA とパルワールドのコミュニティ「Village Server」の公式サイト案です。Beer CSS（Material Design 3）で作っています。

## ファイル

- `src/village-server.src.html` … 編集するのはこのファイルです。
- `vendor/` … Beer CSS 5.0.3（MIT）と波形プログレス用の画像。
- `build.ps1` … `src` と `vendor` から `village-server.html` を作ります。
- `village-server.html` … 公開するページ（ビルド結果）。
- `img/` … ページで使う画像。

## ビルド

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```
