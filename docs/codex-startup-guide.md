Codex 起動手順（Windows / PowerShell）
① PowerShellを開く

Windows Terminal または PowerShell を起動する。

② プロジェクトフォルダへ移動
cd C:\Users\bebop\OneDrive\Desktop\fishing-log-app
③ Codexを起動
codex

※ もし認識しない場合

codex.cmd
④ 開発指示書を渡す

作成した

development-instruction-no008-20260801.txt

を

PowerShellへドラッグ＆ドロップ

してEnter。

（Codexがファイルを読み始める。）

⑤ 質問が来たら回答

Codexが

不明点
確認事項

を質問してくるので回答する。

⑥ 作業完了

Codexが

development-report-no008-20260801.txt

を

docs/

へ保存してくれる。

内容を確認して社長承認。

ローカルでアプリを確認する方法

別のPowerShellを開いて

cd C:\Users\bebop\OneDrive\Desktop\fishing-log-app

↓

npx.cmd --yes http-server@14.1.1 . -p 8000 -c-1

ブラウザで

http://localhost:8000

を開く。

スマホなら

http://PCのIPアドレス:8000
終了方法
Codex

そのまま

exit

または

Ctrl + C

その後ウィンドウを閉じる。

ローカルサーバー

起動しているPowerShellで

Ctrl + C