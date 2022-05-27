/**
 * Lambdaにデプロイ済
 * Kinesis Video Stream の RAWデータをWAVファイルに変換
 * 
 * 
 */

// 初期設定
const AWS = require("aws-sdk");
const region = 'ap-northeast-1';
// バケット指定
const bucketName = 'xxxxxxxxxxx';

// S3へプットされたことをトリガーに処理が走る
exports.handler = async (event) => {

    // s3インスタンス化
    const s3 = new S3(AWS, region);

    // レコード数分繰り返し
    for (let record of event.Records) {
        const key = record.s3.object.key;

        // S3から録音データに関する情報を取得
        const data = await s3.get(record.s3.bucket.name, key);
        const info = JSON.parse(data.Body);
        const streamName = info.streamARN.split('stream/')[1].split('/')[0];
        const fragmentNumber =  info.startFragmentNumber;
        
        // Kinesis Video Streamsから当該RAWデータの取得
        const raw = await getMedia(streamName, fragmentNumber);

        // RAWデータからWAVファイルを作成
        const wav = Converter.createWav(raw, 8000);

        // WAVファイルをS3に保存する
        let tagging = ''; // 付加情報をタグに追加する
        tagging += "customerEndpoint=" + info.customerEndpoint + '&';
        tagging += "systemEndpoint=" + info.systemEndpoint + '&';
        tagging += "startTimestamp=" + info.startTimestamp + '&';
        tagging += "stopTimestamp=" + info.stopTimestamp;
        await s3.put(bucketName, key + '.wav', Buffer.from(wav.buffer), tagging)

    }
    return {};
};

// S3クラス
class S3 {
    constructor(AWS, region){
        this._s3 = new AWS.S3({region:region});
    }
    async get(bucketName, key){
        const params = {
            Bucket: bucketName,
            Key: key
        };
        return await this._s3.getObject(params).promise();
    }

    async put(bucketName, key, body, tagging) {
        const params = {
            Bucket: bucketName,
            Key: key,
            Body: body,
            Tagging: tagging
        };
        return  await this._s3.putObject(params).promise();
    }

}

const ebml = require('ebml');

async function getMedia(streamName, fragmentNumber) {
    // Endpointの取得
    const kinesisvideo = new AWS.KinesisVideo({region: region});
    var params = {
        APIName: "GET_MEDIA",
        StreamName: streamName
    };
    const end = await kinesisvideo.getDataEndpoint(params).promise();

    // RAWデータの取得
    const kinesisvideomedia = new AWS.KinesisVideoMedia({endpoint: end.DataEndpoint, region:region});
    var params = {
        StartSelector: { 
            StartSelectorType: "FRAGMENT_NUMBER",
            AfterFragmentNumber:fragmentNumber,
        },
        StreamName: streamName
    };
    const data = await kinesisvideomedia.getMedia(params).promise();
    const decoder = new ebml.Decoder();
    let chunks = [];
    decoder.on('data', chunk => {
        if(chunk[1].name == 'SimpleBlock'){
            chunks.push(chunk[1].data);
        }
    });
    decoder.write(data["Payload"]);
    
    // chunksの結合
    const margin = 4; // 各chunkの先頭4バイトを破棄する
    var sumLength = 0;
    chunks.forEach( chunk => {
        sumLength += chunk.byteLength - margin;
    })
    var sample = new Uint8Array(sumLength);
    var pos = 0;
    chunks.forEach(chunk => {
        let tmp = new Uint8Array(chunk.byteLength - margin);
        for(var e = 0; e < chunk.byteLength -  margin; e++){
            tmp[e] = chunk[e + margin];
        }
        sample.set(tmp, pos);
        pos += chunk.byteLength - margin;

    })
    return sample.buffer;
}