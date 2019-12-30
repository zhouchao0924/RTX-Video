/* eslint-disable no-await-in-loop1 */
const express = require('express');

const router = express.Router();

const shell = require('shelljs');

const fs = require('fs');

const path = require('path');

const request = require('request');

const agileLog = require('agile-log');

const os = require('os');

const log = agileLog.getLogger('app');

const ffmpeg = 'ffmpeg';

const magick = 'magick';

const concat = require('ffmpeg-concat');

const exectime = require('child_process').exec;

let delpath;//任务结束要删除的目录
let totaltime;//视频总时长
let Path;//UEsaved图片目录
let jobId;//任务id
let SolutionId;//方案id
let StyleId;//风格ID
let RootPath;//node工程imagesapce的根目录

// 执行cmd命令
function exec(cmd) {
  try {
    return new Promise((resolve) => {
      shell.exec(cmd, (code, stdout) => {
        if (stdout) {
          resolve(stdout);
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    return new Promise((resolve) => {
      shell.exec(cmd, (code, stdout) => {
        if (stdout) {
          log.info(`${SolutionId}shell失败重试`);
          resolve(stdout);
        } else {
          log.info(`${SolutionId}shell失败重试`);
          resolve();
        }
      });
    });
  }
}

// 图片名称左边补0
function intToString(num, n) {
  let len = num.toString().length;
  while (len < n) {
    num = `0${num}`;
    len += 1;
  }
  return num;
}

// 删除文件夹
function deleteFolder(solutionpath) {
  let files = [];
  if (fs.existsSync(solutionpath)) {
    files = fs.readdirSync(solutionpath);
    files.forEach((file) => {
      const curPath = `${solutionpath}/${file}`;
      if (fs.statSync(curPath).isDirectory()) { // recurse
        deleteFolder(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(solutionpath);
  }
}

// 完成和失败都要做的错误处理
function complete(logs) {
  log.info(logs);
  deleteFolder(delpath);
}

// 上传完成后，给后台的回执
function callback(SolutionId, url) {
  const requestData = {
    message: '视频制作完成',
    solutionId: SolutionId,
    jobId: jobId,
    success: true,
    videoUrl: url
  };
  const options = {
    url: 'http://irayproxy.sit.ihomefnt.org/collectVideoResult',
    method: 'POST',
    json: true,
    headers: {
      'Content-Type': 'application/json'
    },
    body: requestData
  };
  request(options, (err, res, body) => {
    if (!err && res.statusCode === 200) {
      if (body.success) {
        complete(`${SolutionId}任务结束,上传回执完成`);
        //只有成功之后才能删除UE4下面的目录
        deleteFolder(`${Path}/MoviePicture/${SolutionId}`);
      } else {
        complete('回执上传失败');
      }
    } else {
      complete('回执接口调动失败');
    }
  });
}

// 上传视频
function UploadMP4(FilePath) {
  let sbody = '';
  const upload = request.post(' http://192.168.1.13:11133/unifyfile/file/drGeneralUpload');
  upload.setHeader('content-type', 'multipart/form-data');
  const form = upload.form();
  form.append('file', fs.createReadStream(`${FilePath}`));

  upload.on('data', (data) => {
    sbody += data;
  }).on('end', () => {
    const obj = JSON.parse(sbody);
    if (obj.success) {
      log.info(`${SolutionId}任务视频上传完成`);
      callback(SolutionId, obj.data);
    } else {
      complete('上传失败');
    }
  }).on('error', () => {
    complete('上传视频接口调用失败');
  });
}

// 添加音乐和水印
async function AddMusic(Filepath) {
  let alltime;
  if (totaltime >= 60) {
    alltime = `00:01:${totaltime - 60}`;
  } else {
    alltime = totaltime + 2;
  }
  //添加水印
  const cmdstring5 = `${ffmpeg} -y -i ${Filepath} -ignore_loop 0 -i ${RootPath}/logo.gif -filter_complex "[0:v][1:v]overlay=50:30:shortest=1" ${delpath}/${SolutionId}-NoMusic.mp4`;
  await exec(cmdstring5);

  //根据系统时间获取音乐
  const myDate = new Date();
  const currentSeconds = myDate.getSeconds().toString();
  const MusicName = currentSeconds.substr(currentSeconds.length - 1, 1);
  const cmdstring3 = `${ffmpeg} -y -i ${RootPath}/${StyleId}/${MusicName}.mp3 -ss 00:00:00 -t ${alltime} -acodec copy ${delpath}/mp3/${SolutionId}.mp3`;
  await exec(cmdstring3);
  const cmdstring4 = `${ffmpeg} -y -i ${delpath}/${SolutionId}-NoMusic.mp4 -i ${delpath}/mp3/${SolutionId}.mp3 -c:v copy -c:a aac -strict experimental ${delpath}/${SolutionId}-output.mp4`;
  await exec(cmdstring4);

  //上传视频
  //UploadMP4(`${delpath}/${SolutionId}-output.mp4`);
}

// 获取视频时长和分辨率
async function getvideotimeandsize(Filepath) {
  const cmd = `ffmpeg -i ${Filepath}`;
  await exectime(cmd, (err, stdout, stderr) => {
    const outStr = stderr.toString();
    const regDurationtime = /Duration\: ([0-9\:\.]+),/;// eslint-disable-line
    const rstime = regDurationtime.exec(outStr);

    if (rstime && rstime[1]) {
      const timeStr = rstime[1];
      const hour = timeStr.split(':')[0];
      const min = timeStr.split(':')[1];
      const sec = timeStr.split(':')[2].split('.')[0];
      totaltime = Number(hour * 3600) + Number(min * 60) + Number(sec);
    }
    AddMusic(Filepath);
  });
}

// 创建文件夹目录
async function CreateSolutiondir(SolutionId, Room) {
  log.info(`${SolutionId}任务开始`);
  RootPath = path.join(__dirname, 'ImageSpace');
  if (!fs.existsSync(RootPath)) {
    fs.mkdirSync(RootPath);
  }
  const SolutionDirPath = path.join(__dirname, `ImageSpace/${SolutionId}`);
  delpath = SolutionDirPath;
  // 按空间创建文件夹
  for (let index = 0; index < Room.length; index += 1) {
    const SolutionRoomDirPath = path.join(SolutionDirPath, `${Room[index]}`);
    const SolutionVideoMp3DirPath = path.join(SolutionDirPath, 'mp3');
    if (!fs.existsSync(SolutionDirPath)) {
      fs.mkdirSync(SolutionDirPath);
    }
    if (!fs.existsSync(SolutionRoomDirPath)) {
      fs.mkdirSync(SolutionRoomDirPath);
    }
    if (!fs.existsSync(SolutionVideoMp3DirPath)) {
      fs.mkdirSync(SolutionVideoMp3DirPath);
    }
  }
}

// 开始处理任务
async function ImagemagickInit() {
  //获取指定路径下所有的文件夹名
  let components = [];
  let AllTsPath = "";
  const files = fs.readdirSync(`${Path}/MoviePicture/${SolutionId}`)
  files.forEach(function (item, index) {
    let stat = fs.lstatSync(`${Path}/MoviePicture/${SolutionId}/` + item)
    if (stat.isDirectory() === true) {
      components.push(item);
    }
  })

  //在Node中创建对应的文件夹
  await CreateSolutiondir(SolutionId, components);

  const SolutionDirPath = path.join(__dirname, `ImageSpace/${SolutionId}`);
  // 按空间文件夹处理图片，每个空间生成视频1.mp4
  for (let index = 0; index < components.length; index += 1) {
    //创建视频接收目录
    const SolutionRoomDirPath = path.join(SolutionDirPath, `${components[index]}`);
    //从UE图片目录生成视频到接收目录
    const cmd1 = `ffmpeg -i ${Path}/MoviePicture//${SolutionId}/${components[index]}/%6d.jpg ${SolutionRoomDirPath}/1.mp4`;
    await exec(cmd1);
    const cmd2 = `ffmpeg -i ${SolutionRoomDirPath}/1.mp4 -vcodec copy -acodec copy -vbsf h264_mp4toannexb ${SolutionRoomDirPath}/1.ts`;
    await exec(cmd2);
    if (index === components.length - 1) {
      AllTsPath = AllTsPath + `${SolutionRoomDirPath}/1.ts`;
    } else {
      AllTsPath = AllTsPath + `${SolutionRoomDirPath}/1.ts|`;
    }
  }
  //视频全部执行完以后获取ts
  const cmd3 = `ffmpeg -y -i "concat:${AllTsPath}" -acodec copy -vcodec copy -absf aac_adtstoasc ${SolutionDirPath}/${SolutionId}-AllNo.mp4`;
  await exec(cmd3);

  //获取视频总时长，准备加音乐
  getvideotimeandsize(`${SolutionDirPath}/${SolutionId}-AllNo.mp4`);
}

router.get('/ImageMagick', async (req, res) => {
  Path = "D:/UnrealProjects/RTX/WindowsNoEditor/ajdr/Saved";
  jobId = req.query.jobId;
  SolutionId = req.query.solutionId;
  StyleId = req.query.styleId;
  res.send('success');

  //开始执行任务
  ImagemagickInit();
});

module.exports = router;
