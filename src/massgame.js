'use strict';

let all; // 全体
let backgroundColor;
let hueSet; // カラーパレット

const COLOR_NUM = 7;

//const INTERVAL = 3; // delayのinterval. // 可変にしてみる
const SPANTIME = 60; // 演技にかかる時間
const WAITSPAN = 60; // 全員演技終わってから再スタートまでのspan
const SIZE = 36; // 変えられるのかどうか知らない。知らないけど。

const IDLE = 0;
const IN_PROGRESS = 1;
const COMPLETED = 2;

function setup(){
  createCanvas(600, 600);
  // palette HSBでやってみたい
  colorMode(HSB, 100);
  backgroundColor = color(63, 20, 100);
  hueSet = [0, 10, 17, 35, 52, 64, 80];
  all = new entity();
  all.initialize();
}

function draw(){
  background(backgroundColor);
  all.update();
  all.draw();
  // デバッグ用
  push();
  fill('red');
  rect(0, 0, 40, 40);
  fill('blue')
  rect(0, 40, 40, 40);
  fill(0);
  text('stop', 10, 20);
  text('start', 10, 60);
  pop();
}

// デバッグ用
function mouseClicked(){
  if(mouseX < 40 && mouseY < 80){
    if(mouseY < 40){ noLoop(); }
    else{ loop(); }
    return;
  }
}

class counter{
  constructor(){
    this.cnt = 0;
  }
  getCnt(){ return this.cnt; }
  reset(){ this.cnt = 0; }
  step(){ this.cnt++; }
}

// 統括する存在
class entity{
  constructor(){
    this.flows = [];
    this.actors = [];
  }
  initialize(){
    // SIZE個のあれ。
    let vecs = getVector(arSinSeq(0, 2 * PI / SIZE, SIZE, 200, 300), arCosSeq(0, 2 * PI / SIZE, SIZE, 200, 300));
    vecs.push(createVector(300, 300));
    console.log(vecs);
    for(let i = 0; i < SIZE; i++){ this.flows.push(new constantFlow(vecs[i], vecs[SIZE])); }
    for(let i = 0; i < SIZE; i++){ this.actors.push(new massCell(this.flows[i], 0, 0)); }
    let waitFlow = new waiting(this.actors[SIZE - 1], 50); // finalActorを登録。
    let cmder = new commander(waitFlow);
    let dictArray = entity.getCommandArray();
    cmder.setCommandArray(dictArray);

    // ここでdelayの初期値を計算
    cmder.delay = cmder.commandArray[0]['delay'];

    let massGameActors = [];
    for(let i = 0; i < SIZE; i++){ massGameActors.push(all.actors[i]); }
    let commandAllFlow = new commandAll(massGameActors);
    let commandDelayFlow = new commandDelay(massGameActors);
    this.actors.push(cmder); // 忘れてた. ていうかこれ上のやつに含めちゃまずいね。
    // 接続
    waitFlow.addFlow(commandDelayFlow); // 0番にディレイ
    waitFlow.addFlow(commandAllFlow);
    commandDelayFlow.addFlow(waitFlow);
    commandAllFlow.addFlow(waitFlow);
    this.activateAll(); // 開始。。いけるの、これ？？
    console.log('massgame start. %d', frameCount);
  }
  update(){
    this.actors.forEach(function(a){ a.update(); })
  }
  draw(){
    this.actors.forEach(function(a){ a.display(); })
  }
  activateAll(){
    this.actors.forEach(function(a){ a.activate(); })
  }
  static getCommandArray(){
    // dictの配列を返す。これはcommanderにセットされる。
    // あとは然るべき規則でここに書き込めば勝手にパターンを次々と演じてくれる。
    // フレーム数調べてカラコン用意してconstantFlow走らせれば色も変えられます。以上。
    let dictArray = [];
    // とりあえず同じもの作ってみるか？
    let vecs = getVector(arSeq(100, 10, 36), constSeq(300, 36));
    let pattern = entity.getDirectCommand(2, vecs, 1);
    dictArray.push(pattern);

    vecs = getVector(constSeq(300, 36), arSeq(100, 12, 36));
    pattern = entity.getDirectCommand(0, vecs, 4);
    dictArray.push(pattern);

    pattern = entity.getRectCommand(7, 100, 100, 300, 300, 2);
    dictArray.push(pattern);
    pattern = entity.getBandCommand(0, 170, 200, PI / 4, 7 * PI / 4, 300, 300, 5);
    dictArray.push(pattern);
    pattern = entity.getEllipseCommand(3, 300, 300, 200, 50, 1);
    dictArray.push(pattern);

    /*dict['delay'] = true;
    dict['interval'] = 2;
    dict['mode'] = 'direct';
    dict['infoVectorArray'] = getVector(arSeq(100, 10, 36), constSeq(300, 36));
    dict['figureId'] = 1;
    dictArray.push(dict);
    let dict2 = {};
    dict2['delay'] = false;
    dict2['mode'] = 'direct';
    dict2['infoVectorArray'] = getVector(constSeq(300, 36), arSeq(100, 12, 36));
    dict2['figureId'] = 4;
    dictArray.push(dict2);
    let dict3 = {};
    dict3['delay'] = true;
    dict3['interval'] = 7;
    dict3['mode'] = 'rect';
    dict3['infoVectorArray'] = getVector([100, 300], [100, 300]);
    dict3['figureId'] = 2;
    dictArray.push(dict3);
    let dict4 = {};
    dict4['delay'] = false;
    dict4['mode'] = 'band';
    dict4['infoVectorArray'] = getVector([170, 0, 300], [200, 2 * PI, 300]);
    dict4['figureId'] = 5;
    dictArray.push(dict4);
    let dict5 = {};
    dict5['delay'] = true;
    dict5['interval'] = 3;
    dict5['mode'] = 'ellipse';
    dict5['infoVectorArray'] = getVector([300, 200], [300, 50]);
    dict5['figureId'] = 1;
    dictArray.push(dict5);*/
    return dictArray;
  }
  static getDirectCommand(delayValue, infoVectorArray, figureId){
    let dict = {};
    entity.preSetting(dict, delayValue, figureId);
    dict['mode'] = 'direct';
    dict['infoVectorArray'] = infoVectorArray;
    return dict;
  }
  static getRectCommand(delayValue, left, up, right, down, figureId){
    let dict = {};
    entity.preSetting(dict, delayValue, figureId);
    dict['mode'] = 'rect'
    dict['infoVectorArray'] = getVector([left, right], [up, down]);
    return dict;
  }
  static getEllipseCommand(delayValue, centerX, centerY, radiusX, radiusY, figureId){
    let dict = {};
    entity.preSetting(dict, delayValue, figureId);
    dict['mode'] = 'ellipse';
    dict['infoVectorArray'] = getVector([centerX, radiusX], [centerY, radiusY]);
    return dict;
  }
  static getBandCommand(delayValue, minRadius, maxRadius, minAngle, maxAngle, centerX, centerY, figureId){
    let dict = {};
    entity.preSetting(dict, delayValue, figureId);
    dict['mode'] = 'band';
    dict['infoVectorArray'] = getVector([minRadius, minAngle, centerX], [maxRadius, maxAngle, centerY]);
    return dict;
  }
  static preSetting(dict, delayValue, figureId){
    if(delayValue > 0){ dict['delay'] = true; dict['interval'] = delayValue; }else{ dict['delay'] = false; }
    dict['figureId'] = figureId;
  }
}

// 作業フロー
class flow{
  constructor(){
    this.index = flow.index++;
    this.convertList = [];
  }
  addFlow(newFlow){
    this.convertList.push(newFlow);
  }
  initialize(_actor){} // 最初にやらせたいことを書いてください
  execute(_actor){ _actor.setState(COMPLETED); }
  convert(_actor){ _actor.currentFlow = this.convertList[0]; } // convertの条件を書いてください(デフォルトはまんま)
}

// コンスタントフロー
// 移動表現 // massCellのデフォルト
class constantFlow extends flow{
  constructor(from, to){
    // fromからtoまでspanTime数のフレームで移動しますよ
    super();
    this.from = createVector(from.x, from.y);
    this.to = createVector(to.x, to.y);
    //console.log(this.from);
  }
  initialize(_actor){
    //console.log('move start. %d', frameCount);
    _actor.timer.reset(); // fromの位置から始まることが前提なので省略
  }
  getProgress(_actor){
    let cnt = _actor.timer.getCnt();
    if(cnt >= SPANTIME){ return 1; }
    return cnt / SPANTIME; // イージングかけるならここ。
  }
  execute(_actor){
    _actor.timer.step(); // stepはこっちに書くのが普通じゃん？
    let progress = this.getProgress(_actor);
    let newX = map(progress, 0, 1, this.from.x, this.to.x);
    let newY = map(progress, 0, 1, this.from.y, this.to.y);
    _actor.setPos(newX, newY);
    if(progress === 1){
      _actor.setState(COMPLETED);
      //console.log('move complete. %d', frameCount)
    } // 終了命令忘れた
  }
  setting(v1, v2){ // セット関数
    this.from = createVector(v1.x, v1.y);
    this.to = createVector(v2.x, v2.y);
  }
}

// まとめて指示
class commandAll extends flow{
  constructor(actorArray){
    super();
    this.actorArray = actorArray;
  }
  initialize(_actor){ console.log("All %d", frameCount); }
  execute(_actor){
    this.actorArray.forEach(function(a){ _actor.command(a); }) // commandはあとで実装する
    _actor.setState(COMPLETED);
    _actor.shiftCommand(); // 次の命令
  }
}
// commandは辞書の配列を使っていろいろ指示するもの（その中にはactivateも入っている）

// ディレイ
// 指定したインターバルごとに個々のあれをactiveさせる（allのメソッドを使う）
class commandDelay extends flow{
  constructor(actorArray){
    super();
    this.actorArray = actorArray;
    this.interval = 1; // 可変
  }
  initialize(_actor){
    console.log("Delay %d", frameCount);
    this.interval = _actor.commandArray[_actor.currentIndex]['interval'];
    _actor.timer.reset();
  }
  execute(_actor){
    _actor.timer.step();
    let cnt = _actor.timer.getCnt();
    if(cnt % this.interval === 0){ _actor.command(this.actorArray[Math.floor(cnt / this.interval) - 1]); }
    if(cnt === this.actorArray.length * this.interval){
      _actor.setState(COMPLETED);
      _actor.shiftCommand(); // 次の命令
    }
  }
}

// 待機命令
// 35番がactiveの間は何もしない
// 35番がnon-activeになったら60カウントしたのちconvert. commanderのデフォルト。
class waiting extends flow{
  constructor(finalActor, span){
    super();
    this.finalActor = finalActor;
    this.span = span;
  }
  initialize(_actor){ _actor.timer.reset(); }
  execute(_actor){
    if(this.finalActor.isActive){ return; }
    _actor.timer.step();
    if(_actor.timer.getCnt() === this.span){ _actor.setState(COMPLETED); }
    //console.log('execute.');
  }
  convert(_actor){
    console.log('complete. %d', frameCount);
    //_actor.shiftCommand(); // 次の命令
    if(_actor.delay){ _actor.currentFlow = this.convertList[0]; }
    else{ _actor.currentFlow = this.convertList[1]; } // delayかけるときは0, そうでなければ1に渡す
  }  // delayはcommanderのプロパティ
}

// アクター
class actor{
  constructor(f = undefined){
    this.index = actor.index++;
    this.currentFlow = f;
    this.timer = new counter();
    this.isActive = false;
    this.state = IDLE;
  }
  activate(){ this.isActive = true; }
  inActivate(){ this.isActive = false; }
  setState(newState){ this.state = newState; }
  setFlow(newFlow){ this.currentFlow = newFlow; }
  update(){
    if(!this.isActive){ return; }
    if(this.state === IDLE){
      this.idleAction();
    }else if(this.state === IN_PROGRESS){
      this.in_progressAction();
    }else if(this.state === COMPLETED){
      //console.log(this.isActive);
      this.completeAction();
    }
  }
  idleAction(){
    this.currentFlow.initialize(this);
    this.setState(IN_PROGRESS);
  }
  in_progressAction(){
    this.currentFlow.execute(this);
  }
  completeAction(){
    this.setState(IDLE);
    this.currentFlow.convert(this); // 基本はconvert.
  }
  display(){}
}

// 個々の部分(initializeでconstantFlowを装備)
class massCell extends actor{
  constructor(f = undefined, colorId, figureId = 0){
    super(f);
    this.pos = createVector(f.from.x, f.from.y); // またポインタ渡してるよこの馬鹿・・・・
    //console.log('initialize of massCell');
    this.visual = new figure(colorId, figureId); // 色は変わるけどね
  }
  changeColor(newHue, newSaturation){
    this.visual.changeColor(newHue, newSaturation);
  }
  changeFigure(newFigureId){
    this.visual.changeFigure(newFigureId);
  }
  setPos(x, y){
    this.pos.set(x, y);
  }
  completeAction(){
    this.setState(IDLE);
    this.inActivate(); // convertせずに待機に戻る
  }
  display(){
    this.visual.display(this.pos);
  }
}

// ビジュアル担当
class figure{
  constructor(colorId, figureId){
    this.myColor = color(hueSet[colorId], 100, 100);
    this.figureId = figureId;
    //console.log('initialize of figure');
    this.graphic = createGraphics(40, 40);
    this.rotation = 0;
    //console.log("234");
    figure.setGraphic(this.graphic, this.myColor, figureId);
  }
  reset(){
    figure.setGraphic(this.graphic, this.myColor, this.figureId);
  }
  changeColor(newHue, newSaturation){
    this.myColor = color(newHue, newSaturation, 100);
    this.reset();
  }
  changeFigure(newFigureId){
    this.figureId = newFigureId;
    this.reset();
  }
  display(pos){ // swingMotion.
    push();
    translate(pos.x, pos.y);
    this.rotation += 0.1;
    rotate((PI / 8) * sin(this.rotation));
    image(this.graphic, -20, -20); // 20x20に合わせる
    pop();
  }
  static setGraphic(gr, myColor, figureId){
    // グラフィック描画
    gr.clear();
    gr.noStroke();
    gr.fill(myColor);
    //console.log('setGraphic');
    if(figureId === 0){
      // 正方形
      gr.rect(10, 10, 20, 20);
      gr.fill(255);
      gr.rect(15, 15, 2, 5);
      gr.rect(23, 15, 2, 5);
    }else if(figureId === 1){
      // 星型
      let outer = rotationSeq(0, -12, 2 * PI / 5, 5, 20, 20);
      let inner = rotationSeq(0, 6, 2 * PI / 5, 5, 20, 20);
      for(let i = 0; i < 5; i++){
        let k = (i + 2) % 5;
        let l = (i + 3) % 5;
        gr.quad(outer[i].x, outer[i].y, inner[k].x, inner[k].y, 20, 20, inner[l].x, inner[l].y);
      }
      gr.fill(0);
      gr.rect(15, 17, 2, 5);
      gr.rect(23, 17, 2, 5);
    }else if(figureId === 2){
      // 三角形
      gr.triangle(20, 20 - 24 / Math.sqrt(3), 32, 20 + (12 / Math.sqrt(3)), 8, 20 + (12 / Math.sqrt(3)));
      gr.fill(255);
      gr.rect(15, 17, 2, 5);
      gr.rect(23, 17, 2, 5);
    }else if(figureId === 3){
      // ひしがた
      gr.quad(28, 20, 20, 20 - 10 * Math.sqrt(3), 12, 20, 20, 20 + 10 * Math.sqrt(3));
      gr.fill(255);
      gr.rect(15, 17, 2, 5);
      gr.rect(23, 17, 2, 5);
    }else if(figureId === 4){
      // 六角形
      gr.quad(32, 20, 26, 20 - 6 * Math.sqrt(3), 14, 20 - 6 * Math.sqrt(3), 8, 20);
      gr.quad(32, 20, 26, 20 + 6 * Math.sqrt(3), 14, 20 + 6 * Math.sqrt(3), 8, 20);
      gr.fill(255);
      gr.rect(15, 17, 2, 5);
      gr.rect(23, 17, 2, 5);
    }else if(figureId === 5){
      // なんか頭ちょろってやつ
      gr.ellipse(20, 20, 20, 20);
      gr.triangle(20, 20, 20 - 5 * Math.sqrt(3), 15, 20, 0);
      gr.fill(255);
      gr.rect(15, 17, 2, 5);
      gr.rect(23, 17, 2, 5);
    }else if(figureId === 6){
      // 逆三角形
      gr.triangle(20, 20 + 24 / Math.sqrt(3), 32, 20 - (12 / Math.sqrt(3)), 8, 20 - (12 / Math.sqrt(3)));
      gr.fill(255);
      gr.rect(15, 17, 2, 5);
      gr.rect(23, 17, 2, 5);
    }else if(figureId === 7){
      // デフォルト用の円形
      gr.ellipse(20, 20, 20, 20);
      gr.fill(255);
      gr.rect(15, 17, 2, 5);
      gr.rect(23, 17, 2, 5);
    }
  }
}

// 司令塔
class commander extends actor{
  constructor(f = undefined){
    super(f);
    this.commandArray = []; // 辞書の配列。constantFlowの位置決定などに関する情報が入っている。順繰りに・・
    this.currentIndex = 0; // 演技の番号みたいなやつ
    this.delay = false; // 該当する演技がdelayかどうか。
  }
  setCommandArray(dictArray){
    this.commandArray = dictArray;
  }
  shiftCommand(){
    let index = (this.currentIndex + 1) % this.commandArray.length;
    if(this.commandArray[index]['delay']){ this.delay = true; }else{ this.delay = false; }
    this.currentIndex = index; // せってい
  }
  command(target){
    let dict = this.commandArray[this.currentIndex];
    let vecs = dict['infoVectorArray'];
    let mode = dict['mode'];
    let v; // toに相当するベクトル
    if(mode === 'rect'){ // 矩形
      let x, y;
      x = map(random(1), 0, 1, vecs[0].x, vecs[1].x);
      y = map(random(1), 0, 1, vecs[0].y, vecs[1].y);
      v = createVector(x, y);
    }else if(mode === 'ellipse'){ // 円形
      let r, theta;
      r = random(1); // vecs[0]が中心でvecs[1]は楕円の横半径と縦半径。
      theta = random(2 * PI);
      v = createVector(vecs[0].x + vecs[1].x * r * cos(theta), vecs[0].y + vecs[1].y * r * sin(theta));
    }else if(mode === 'band'){ // 帯
      let r, theta;
      r = vecs[0].x + random(vecs[0].y - vecs[0].x); // 帯の最小と最大
      theta = vecs[1].x + random(vecs[1].y - vecs[1].x) // 角度
      v = createVector(vecs[2].x + r * cos(theta), vecs[2].y + r * sin(theta));
    }else{
      // ダイレクト指示
      v = vecs[target.index];
    }
    target.currentFlow.setting(target.pos, v); // fromを現在位置、toを目的地に設定
    target.changeFigure(dict['figureId']); // 姿を変える
    target.activate(); // 起動。
  }
}

flow.index = 0;
actor.index = 0;

// --------------------------------------------------------------------------------------- //
// utility.
function typeSeq(typename, n){
  // typenameの辞書がn個。
  let array = [];
  for(let i = 0; i < n; i++){ array.push({type: typename}); }
  return array;
}

function constSeq(c, n){
  // cがn個。
  let array = [];
  for(let i = 0; i < n; i++){ array.push(c); }
  return array;
}

function jointSeq(arrayOfArray){
  // 全部繋げる
  let array = arrayOfArray[0];
  //console.log(array);
  for(let i = 1; i < arrayOfArray.length; i++){
    array = array.concat(arrayOfArray[i]);
  }
  return array;
}

function multiSeq(a, m){
  // arrayがm個
  let array = [];
  for(let i = 0; i < m; i++){ array = array.concat(a); }
  return array;
}

function arSeq(start, interval, n){
  // startからintervalずつn個
  let array = [];
  for(let i = 0; i < n; i++){ array.push(start + interval * i); }
  return array;
}

function arCosSeq(start, interval, n, radius = 1, pivot = 0){
  // startからintervalずつn個をradius * cos([]) の[]に放り込む。pivotは定数ずらし。
  let array = [];
  for(let i = 0; i < n; i++){ array.push(pivot + radius * cos(start + interval * i)); }
  return array;
}

function arSinSeq(start, interval, n, radius = 1, pivot = 0){
  // startからintervalずつn個をradius * sin([]) の[]に放り込む。pivotは定数ずらし。
  let array = [];
  for(let i = 0; i < n; i++){ array.push(pivot + radius * sin(start + interval * i)); }
  return array;
}

function rotationSeq(x, y, angle, n, centerX = 0, centerY = 0){
  // (x, y)をangleだけ0回～n-1回回転させたもののセットを返す(中心はオプション、デフォルトは0, 0)
  let array = [];
  let vec = createVector(x, y);
  array.push(createVector(x + centerX, y + centerY));
  for(let k = 1; k < n; k++){
    vec.set(vec.x * cos(angle) - vec.y * sin(angle), vec.x * sin(angle) + vec.y * cos(angle));
    array.push(createVector(vec.x + centerX, vec.y + centerY));
  }
  return array;
}

function multiRotationSeq(array, angle, n, centerX = 0, centerY = 0){
  // arrayの中身をすべて然るべくrotationしたものの配列を返す
  let finalArray = [];
  array.forEach(function(vec){
    let rotArray = rotationSeq(vec.x, vec.y, angle, n, centerX, centerY);
    finalArray = finalArray.concat(rotArray);
  })
  return finalArray;
}

function randomInt(n){
  // 0, 1, ..., n-1のどれかを返す
  return Math.floor(random(n));
}

function getVector(posX, posY){
  let vecs = [];
  for(let i = 0; i < posX.length; i++){
    vecs.push(createVector(posX[i], posY[i]));
  }
  return vecs;
}

function commandShuffle(array, sortArray){
  // arrayを好きな順番にして返す。たとえばsortArrayが[0, 3, 2, 1]なら[array[0], array[3], array[2], array[1]].
  let newArray = [];
  for(let i = 0; i < array.length; i++){
    newArray.push(array[sortArray[i]]);
  }
  return newArray; // もちろんだけどarrayとsortArrayの長さは同じでsortArrayは0~len-1のソートでないとエラーになる
}

function reverseShuffle(array){
  // 通常のリバース。
  let newArray = [];
  for(let i = 0; i < array.length; i++){ newArray.push(array[array.length - i - 1]); }
  return newArray;
}
