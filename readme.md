# Amazon Connect　留守番電話機能の実装

## 以下の記事を参考にしました。
https://dev.classmethod.jp/articles/amazon-connect-voice-mail-from-kinesis-video-stream/

## index.html
留守番電話一覧を表示させるファイルです

## index.js
LambdaとしてAWS上にデプロイしております。
Kinesis Video Streams 録音がPUTされる事をトリガーにRAWファイルからWAVファイルへ変換します。