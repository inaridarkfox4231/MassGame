'use strict';

let all; // 全体
let backgroundColor;
let hueSet; // カラーパレット

// 主な変更点：
// 現在SPANTIME及びWAITSPANとなっているところをactTime, pauseTimeとしてパターンのプロパティに追加。

// カラーコントロールはhueだけいじるように変更して背景色もsaturationは40か50くらいで固定してhueだけ変える。
// 背景はactorとしてcommanderに所属させconstantFlow走らせて色変更、というか、
// いわゆる単色グラフィックとしてdraw命令で最初に描画させることにする（応用が利く）。
// さらに冒頭の演技をランダム配置からの円形へのチェンジにしてそこから正方形バリエーションという流れにする。
// そのためにスタートの位置も若干工夫する。
// しかもそのバリエーションを0番に配置するのでpatternChangeはちゃんとwaitingのconvert時に行うことができる。
// これにより2箇所に分けて書く必要がなくなる。とりあえず、以上。

// あともうひとつ。カラーコントロールでwaitingのときコントローラも止まるようにしてね。

const COLOR_NUM = 7;

//const INTERVAL = 3; // delayのinterval. // 可変にしてみる
//const SPANTIME = 60; // 演技にかかる時間
//const WAITSPAN = 60; // 全員演技終わってから再スタートまでのspan
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
    let vecs = getVector(arSinSeq(0, 2 * PI / 36, 36, 200, 300), arCosSeq(0, 2 * PI / 36, 36, 200, 300));
    //vecs.push(createVector(300, 300));
    //v = createVector(300, 300);
    // これで初期位置が(300, 300)になる。
    for(let i = 0; i < SIZE; i++){ this.flows.push(new constantFlow(vecs[i], createVector(300, 300), 60)); }
    for(let i = 0; i < SIZE; i++){ this.actors.push(new massCell(this.flows[i], 0, 0)); }
    // commanderの準備として一連のflowとあとtroopを準備する
    let commandAllFlow = new commandAll(); // 引数をなくす
    let commandDelayFlow = new commandDelay();
    let waitFlow = new waiting();
    let troop = []; // 演技者の集団
    for(let i = 0; i < SIZE; i++){ troop.push(all.actors[i]); }
    // commanderを生成(最初の命令がdelayなのでdelayからスタート)
    let cmder = new commander(commandAllFlow, troop);
    let dictArray = entity.getCommandArray();
    cmder.setCommandArray(dictArray);
    this.actors.push(cmder); // 忘れてた. ていうかこれ上のやつに含めちゃまずいね。

    // ここでdelayの初期値を計算→廃止
    //cmder.delay = cmder.commandArray[0]['delay'];

    // 接続
    waitFlow.addFlow(commandDelayFlow); // 0番にディレイ
    waitFlow.addFlow(commandAllFlow);
    commandDelayFlow.addFlow(waitFlow);
    commandAllFlow.addFlow(waitFlow);
    //this.activateAll(); // 開始。。いけるの、これ？？
    // activateするのは設定した後なのでcommanderだけactivateする。つまりIDLEかつnon-Activeってことね。
    // 命令を受けてconstantFlowが完成した直後にactivateされるという仕掛け。
    cmder.activate();
    console.log('MassGame start. %d', frameCount);
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
    // とりあえず同じもの作ってみるか？初期位置中心でスタート。
    // まず中心にぎゅっ。
    let vecs = getVector(constSeq(300, 36), constSeq(300, 36));
    let pattern = entity.getDirectCommand(0, 30, 60, vecs, 7);
    dictArray.push(pattern);
    // 次にrectのrandom.
    pattern = entity.getRectCommand(0, 40, 60, 100, 100, 500, 500, 7);
    dictArray.push(pattern);
    // 次に正方形.
    vecs = getPatternVector(0);
    pattern = entity.getDirectCommand(2, 50, 30, vecs, 0);
    dictArray.push(pattern);
    // 次に上向きの扇形ランダム
    pattern = entity.getBandCommand(0, 40, 40, 150, 175, 0, PI, 300, 300, 0);
    dictArray.push(pattern);
    // 星型。
    vecs = getPatternVector(1);
    pattern = entity.getDirectCommand(4, 50, 40, vecs, 1);
    dictArray.push(pattern);
    // 十字型。
    vecs = getPatternVector(2);
    pattern = entity.getDirectCommand(3, 50, 40, vecs, 1);
    dictArray.push(pattern);
    // 三角形。
    vecs = getPatternVector(3);
    pattern = entity.getDirectCommand(4, 50, 40, vecs, 2);
    dictArray.push(pattern);
    // 横長rectランダム（これ本当は右向き扇状に中心スタートできれいに並べたい）
    pattern = entity.getRectCommand(0, 50, 60, 100, 250, 500, 350, 2);
    dictArray.push(pattern);
    // ひし形4つ
    vecs = getPatternVector(4);
    pattern = entity.getDirectCommand(4, 70, 40, vecs, 3);
    dictArray.push(pattern);
    // 縦長rectランダム
    pattern = entity.getRectCommand(0, 50, 60, 250, 100, 350, 500, 3);
    dictArray.push(pattern);
    // 六角形
    vecs = getPatternVector(5);
    pattern = entity.getDirectCommand(4, 50, 60, vecs, 4);
    dictArray.push(pattern);
    // たて直線
    vecs = getVector(constSeq(300, 36), arSeq(125, 10, 36));
    pattern = entity.getDirectCommand(3, 30, 40, vecs, 4);
    dictArray.push(pattern);
    // らせん
    vecs = getPatternVector(6);
    pattern = entity.getDirectCommand(2, 40, 50, vecs, 5);
    dictArray.push(pattern);
    // よこ直線
    vecs = getVector(arSeq(125, 10, 36), constSeq(300, 36));
    pattern = entity.getDirectCommand(3, 40, 30, vecs, 5);
    dictArray.push(pattern);
    // 最後は円形配置
    vecs = getVector(arSinSeq(0, 2 * PI / 36, 36, 200, 300), arCosSeq(0, 2 * PI / 36, 36, 200, 300));
    pattern = entity.getDirectCommand(2, 40, 40, vecs, 6);
    dictArray.push(pattern);

    return dictArray;
  }
  static getDirectCommand(delay, pauseTime, actTime, infoVectorArray, figureId){
    let dict = {};
    entity.preSetting(dict, delay, pauseTime, actTime, figureId);
    dict['mode'] = 'direct';
    dict['infoVectorArray'] = infoVectorArray;
    return dict;
  }
  static getRectCommand(delay, pauseTime, actTime, left, up, right, down, figureId){
    let dict = {};
    entity.preSetting(dict, delay, pauseTime, actTime, figureId);
    dict['mode'] = 'rect'
    dict['infoVectorArray'] = getVector([left, right], [up, down]);
    return dict;
  }
  static getEllipseCommand(delay, pauseTime, actTime, centerX, centerY, radiusX, radiusY, figureId){
    let dict = {};
    entity.preSetting(dict, delay, pauseTime, actTime, figureId);
    dict['mode'] = 'ellipse';
    dict['infoVectorArray'] = getVector([centerX, radiusX], [centerY, radiusY]);
    return dict;
  }
  static getBandCommand(delay, pauseTime, actTime, minRadius, maxRadius, minAngle, maxAngle, centerX, centerY, figureId){
    let dict = {};
    entity.preSetting(dict, delay, pauseTime, actTime, figureId);
    dict['mode'] = 'band';
    dict['infoVectorArray'] = getVector([minRadius, minAngle, centerX], [maxRadius, maxAngle, centerY]);
    return dict;
  }
  static preSetting(dict, delay, pauseTime, actTime, figureId){
    //if(delayValue > 0){ dict['delay'] = true; dict['interval'] = delayValue; }else{ dict['delay'] = false; }
    dict['delay'] = delay; // intervalは廃止してdelayの0か正かで判断することに。
    dict['pauseTime'] = pauseTime;
    dict['actTime'] = actTime;
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
  constructor(from, to, actTime){
    // fromからtoまでspanTime数のフレームで移動しますよ
    super();
    this.from = createVector(from.x, from.y);
    this.to = createVector(to.x, to.y);
    //console.log(this.from);
    this.actTime = actTime; // 基本60.
  }
  initialize(_actor){
    //console.log('move start. %d', frameCount);
    _actor.timer.reset(); // fromの位置から始まることが前提なので省略
  }
  getProgress(_actor){
    let cnt = _actor.timer.getCnt();
    if(cnt >= this.actTime){ return 1; }
    return cnt / this.actTime;
  }
  execute(_actor){
    _actor.timer.step(); // stepはこっちに書くのが普通じゃん？
    let progress = this.getProgress(_actor);
    // イージングかけるならここ。
    // なお今回actorごとに異なるconstantFlowを与えているのでこっちもちで・・それは邪道かなぁ。
    // いわゆる法ベクトルを装備できるので、それ使って簡単に・・ねぇ？

    if(progress < 1){ progress = constantFlow.easing(8, progress); }

    let newX = map(progress, 0, 1, this.from.x, this.to.x);
    let newY = map(progress, 0, 1, this.from.y, this.to.y);
    _actor.setPos(newX, newY);
    if(progress === 1){
      _actor.setState(COMPLETED);
      //console.log('move complete. %d', frameCount)
    } // 終了命令忘れた
  }
  setting(v1, v2, actTime){ // セット関数
    this.from = createVector(v1.x, v1.y);
    this.to = createVector(v2.x, v2.y);
    this.actTime = actTime;
  }
  static easing(i, x){
    if(i === 0){ return (50 / 23) * (-2 * pow(x, 3) + 3 * pow(x, 2) - 0.54 * x); } // バックインアウト
    else if(i === 1){ return x + 0.1 * sin(8 * PI * x); } // ぐらぐら
    else if(i === 2){ return -12 * pow(x, 3) + 18 * pow(x, 2) - 5 * x; } // 大きいバックインアウト
    else if(i === 3){ return (x / 8) + (7 / 8) * pow(x, 4); } // ゆっくりぎゅーーーん
    else if(i === 4){ return (7 / 8) + (x / 8) - (7 / 8) * pow(1 - x, 4); } // ぎゅーーんゆっくり
    else if(i === 5){ return 0.5 * (1 - cos(PI * x)); } // ゆっくりぎゅーんゆっくり
    else if(i === 6){ return log(x + 1) / log(2);  } // 対数的
    else if(i === 7){ return pow(x, 6); } // 鋭く！
    else if(i === 8){ return x * (3 * x - 2); } // おおきくバックからぎゅーん
  }
}

// ディレイ
// 指定したインターバルごとに個々のあれをactiveさせる（allのメソッドを使う）
class commandDelay extends flow{
  constructor(){
    super();
    //this.actorArray = actorArray;
    this.delay = 1; // 可変
  }
  initialize(_actor){
    console.log("Delay %d", frameCount);
    this.delay = _actor.commandArray[_actor.currentIndex]['delay'];
    _actor.timer.reset();
  }
  execute(_actor){
    _actor.timer.step();
    let cnt = _actor.timer.getCnt();
    //if(cnt % this.interval === 0){ _actor.command(this.actorArray[Math.floor(cnt / this.interval) - 1]); }
    //if(cnt === this.actorArray.length * this.interval){
    if(cnt % this.delay === 0){ _actor.command(_actor.troop[Math.floor(cnt / this.delay) - 1]); }
    if(cnt === _actor.troop.length * this.delay){
      _actor.setState(COMPLETED);
      //_actor.shiftCommand(); // 次の命令
    }
  }
}

// まとめて指示
class commandAll extends flow{
  constructor(){
    super();
    //this.actorArray = actorArray;
  }
  initialize(_actor){ console.log("All %d", frameCount); }
  execute(_actor){
    _actor.troop.forEach(function(a){ _actor.command(a); }) // troopの各メンバーに命令
    //this.actorArray.forEach(function(a){ _actor.command(a); }) // commandはあとで実装する
    _actor.setState(COMPLETED);
    //_actor.shiftCommand(); // 次の命令
  }
}
// commandは辞書の配列を使っていろいろ指示するもの（その中にはactivateも入っている）

// 待機命令
// 35番がactiveの間は何もしない
// 35番がnon-activeになったら60カウントしたのちconvert. commanderのデフォルト。
class waiting extends flow{
  constructor(){
    super();
    //this.finalActor = finalActor; // commanderのanchorプロパティとして参照
    this.pauseTime = 0; // 可変にする
  }
  initialize(_actor){
    _actor.timer.reset();
    this.pauseTime = _actor.commandArray[_actor.currentIndex]['pauseTime']; // 辞書から決定
  }
  execute(_actor){
    //if(this.finalActor.isActive){ return; }
    if(_actor.anchor.isActive){ return; } // アンカーが演技中の時は何もしない
    _actor.timer.step();
    if(_actor.timer.getCnt() === this.pauseTime){ _actor.setState(COMPLETED); }
    //console.log('execute.');
  }
  convert(_actor){
    console.log('complete. %d', frameCount);
    _actor.shiftCommand(); // 次の命令
    //console.log(_actor.commandArray);
    let delay = _actor.commandArray[_actor.currentIndex]['delay']; // 0がdelayなしの意味
    if(delay > 0){ _actor.currentFlow = this.convertList[0]; } // delayかけるときは0番
    else{ _actor.currentFlow = this.convertList[1]; } // かけないときは1番
    //console.log(_actor.currentFlow);
    //if(_actor.delay){ _actor.currentFlow = this.convertList[0]; }
    //else{ _actor.currentFlow = this.convertList[1]; } // delayかけるときは0, そうでなければ1に渡す
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
    //console.log(this.pos);
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
      gr.fill(255);
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
  constructor(f = undefined, troop){
    super(f);
    this.commandArray = []; // 辞書の配列。constantFlowの位置決定などに関する情報が入っている。順繰りに・・
    this.currentIndex = 0; // 演技の番号みたいなやつ
    //this.delay = false; // 該当する演技がdelayかどうか。
    this.troop = troop; // メインアクターの配列(troop)
    this.anchor = this.troop[this.troop.length - 1]; // アンカー（最後に演技する人）
  }
  setCommandArray(dictArray){
    this.commandArray = dictArray;
  }
  shiftCommand(){
    let index = (this.currentIndex + 1) % this.commandArray.length;
    //if(this.commandArray[index]['delay']){ this.delay = true; }else{ this.delay = false; }
    this.currentIndex = index; // せってい
  }
  command(member){
    // targetというか各メンバーに
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
      v = vecs[member.index];
      //console.log(v);
    }
    member.currentFlow.setting(member.pos, v, dict['actTime']); // fromを現在位置、toを目的地に設定
    member.changeFigure(dict['figureId']); // 姿を変える
    member.activate(); // 起動。
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

// --------------------------------//
// getPatternVector.
function getPatternVector(patternIndex){
  if(patternIndex === 0){
    // 正方形
    let posX = multiSeq(arSeq(150, 60, 6), 6);
    let posY = jointSeq([constSeq(150, 6), constSeq(210, 6), constSeq(270, 6), constSeq(330, 6), constSeq(390, 6), constSeq(450, 6)]);
    let vecs = getVector(posX, posY);
    return commandShuffle(vecs, [0, 1, 6, 12, 7, 2, 3, 8, 13, 18, 24, 19, 14, 9, 4, 5, 10, 15, 20, 25, 30, 31, 26, 21, 16, 11, 17, 22, 27, 32, 33, 28, 23, 29, 34, 35]);
  }else if(patternIndex === 1){
    // 星型
    let vecs = [createVector(300, 300)];
    vecs = vecs.concat(rotationSeq(0, -48, 2 * PI / 5, 5, 300, 300));
    vecs = vecs.concat(rotationSeq(0, -96, 2 * PI / 5, 5, 300, 300));
    let d0 = 96 * sin(2 * PI / 10); // 中心から上に向かって辺に突き刺さるまでの距離
    let d1 = 32 * sin(2 * PI / 10) * tan(2 * PI / 5); // そこからてっぺんまでの距離の1/3.
    let d2 = 32 * sin(2 * PI / 10);
    // segmentを作って2 * PI / 5ずつ回転させてまとめてゲットする
    let posX = [0, d2, 2 * d2, -d2, -2 * d2];
    let posY = [-d0 - 3 * d1, -d0 - 2 * d1, -d0 - d1, -d0 - 2 * d1, -d0 - d1];
    let segmentVecs = getVector(posX, posY);
    let aroundVecs = multiRotationSeq(segmentVecs, 2 * PI / 5, 5, 300, 300);
    vecs = vecs.concat(aroundVecs);
    return commandShuffle(vecs, [11, 26, 16, 31, 21, 15, 20, 25, 8, 9, 32, 27, 12, 30, 3, 4, 17, 35, 7, 2, 0, 5, 10, 22, 24, 1, 33, 19, 6, 28, 14, 29, 34, 23, 18, 13]);
  }else if(patternIndex === 2){
    // 十字型
    let posX = jointSeq([arSeq(120, 40, 4), arSeq(120, 40, 4), constSeq(280, 10), constSeq(320, 10), arSeq(360, 40, 4), arSeq(360, 40, 4)]);
    let posY = jointSeq([constSeq(280, 4), constSeq(320, 4), arSeq(120, 40, 10), arSeq(120, 40, 10), constSeq(280, 4), constSeq(320, 4)]);
    let vecs = getVector(posX, posY);
    return commandShuffle(vecs, [17, 27, 26, 16, 15, 25, 24, 14, 13, 7, 6, 5, 4, 23, 32, 33, 34, 35, 12, 3, 2, 1, 0, 22, 28, 29, 30, 31, 11, 21, 20, 10, 9, 19, 18, 8]);
  }else if(patternIndex === 3){
    // 三角形
    let x, y;
    let vecs = [];
    for(let i = 0; i < 8; i++){
      x = 300 - 15 * Math.sqrt(3) * i;
      y = 90 + 45 * i;
      vecs.push(createVector(x, y));
      for(let k = 0; k < i; k++){
        x += 30 * Math.sqrt(3);
        vecs.push(createVector(x, y));
      }
    }
    return vecs;
  }else if(patternIndex === 4){
    // ひし形4つ。
    let r = 20 * Math.sqrt(3);
    let posX = [0, 20, -20, 40, 0, -40, 20, -20, 0];
    let posY = [40, 40 + r, 40 + r, 40 + 2 * r, 40 + 2 * r, 40 + 2 * r, 40 + 3 * r, 40 + 3 * r, 40 + 4 * r];
    let segmentVecs = getVector(posX, posY);
    let vecs = multiRotationSeq(segmentVecs, PI / 2, 4, 300, 300);
    return commandShuffle(vecs, [33, 29, 25, 13, 17, 21, 9, 5, 1, 2, 6, 14, 0, 8, 20, 10, 18, 26, 4, 16, 28, 22, 30, 34, 12, 24, 32, 3, 7, 11, 23, 19, 15, 27, 31, 35]);
  }else if(patternIndex === 5){
    // 六角形
    let r = 20 * Math.sqrt(3);
    let posX = [r, 0, 2 * r, -r, r, 3 * r];
    let posY = [60, 120, 120, 180, 180, 180];
    let segmentVecs = getVector(posX, posY);
    let vecs = multiRotationSeq(segmentVecs, PI / 3, 6, 300, 300);
    return commandShuffle(vecs, [35, 29, 23, 30, 24, 12, 11, 17, 22, 28, 10, 5, 0, 6, 18, 31, 13, 1, 4, 16, 34, 21, 9, 3, 2, 7, 25, 19, 14, 8, 15, 27, 33, 20, 26, 32]);
  }else if(patternIndex === 6){
    // らせん
    let vecs = [];
    for(let k = 1; k <= 36; k++){
      vecs.push(createVector(300 + (30 + 6 * k) * cos((2 * PI / 15) * k), 300 + (30 + 6 * k) * sin((2 * PI / 15) * k)));
    }
    return vecs;
  }
}
