'use strict';

let conductor; // 指揮者
let backgroundColor;
let hueSet; // カラーパレット

const COLOR_NUM = 7;

const SIZE = 36; // 変えられるのかどうか知らない。知らないけど。

const IDLE = 0;
const IN_PROGRESS = 1;
const COMPLETED = 2;

function setup(){
  createCanvas(600, 600);
  // palette HSBでやってみたい
  colorMode(HSB, 100);
  backgroundColor = color(0, 40, 100);
  hueSet = [0, 10, 17, 35, 52, 64, 80];
  let _flow = new preparation(); // 最初の準備用フロー
  conductor = new commander(_flow); // 最初のフローを登録
  conductor.activate(); // activateすればすべてが動き出す。みんなactorだった・・・
}

function draw(){
  background(backgroundColor);
  conductor.update();
  conductor.display();
}

class counter{
  constructor(){
    this.cnt = 0;
    this.limit = 0; // まずはlimitを復活させる
  }
  getCnt(){ return this.cnt; }
  setting(limit){
    this.cnt = 0;
    this.limit = limit; // limitを登録
  }
  step(){ this.cnt++; }
  getProgress(){
    // if(this.limit < 0){ return this.cnt; }
    if(this.cnt === this.limit){ return 1; }
    return this.cnt / this.limit;
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
  constructor(from, to, actTime = 60, fromHue = 0, toHue = 0){
    // fromからtoまでspanTime数のフレームで移動しますよ
    super();
    this.from = createVector(from.x, from.y);
    this.to = createVector(to.x, to.y);
    this.fromHue = fromHue;
    this.toHue = toHue;
    this.actTime = actTime; // 基本60.
  }
  initialize(_actor){
    //console.log('move start. %d', frameCount);
    _actor.timer.setting(this.actTime); // fromの位置から始まることが前提なので省略
		//_actor.diffAngle = random(2 * PI); // 摂動角
  }
  execute(_actor){
    _actor.timer.step(); // stepはこっちに書くのが普通じゃん？
    let prg = _actor.timer.getProgress();
    // イージングかけるならここ。
    // なお今回actorごとに異なるconstantFlowを与えているのでこっちもちで・・それは邪道かなぁ。
    // いわゆる法ベクトルを装備できるので、それ使って簡単に・・ねぇ？

    if(prg < 1){ prg = constantFlow.easing(8, prg); }

    let newX = map(prg, 0, 1, this.from.x, this.to.x);
    let newY = map(prg, 0, 1, this.from.y, this.to.y);
		// ここ。
		//newX += 30 * sin(2 * PI * progress) * cos(_actor.diffAngle);
		//newY += 30 * sin(2 * PI * progress) * sin(_actor.diffAngle);
		//_actor.diffAngle += (random(1) < 0.5 ? 0.03 : -0.03);

    _actor.setPos(newX, newY);
    let newHue = map(prg, 0, 1, this.fromHue, this.toHue);
    _actor.changeColor(newHue, 100);
    _actor.currentHue = newHue; // hueの更新
    if(prg === 1){
      _actor.setState(COMPLETED);
    } // 終了命令忘れた
  }
  setting(v1, v2, actTime, h1, h2){ // セット関数
    //console.log("%d %d %d %d", v1.x, v1.y, v2.x, v2.y);
    this.from = createVector(v1.x, v1.y);
    this.to = createVector(v2.x, v2.y);
    this.fromHue = h1;
    this.toHue = h2;
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

class commandAct extends flow{
  constructor(){
    super();
  }
  initialize(_actor){
    _actor.timer.setting(1); // ここでやることはタイマーのセットだけね。
  }
  execute(_actor){
    let prg = _actor.timer.getProgress();
    if(prg < 1){
      _actor.timer.step();
      this.command(_actor); // commandの内容。ディレイか、一斉か。
    }else{
      if(_actor.anchor.isActive){ return; } // anchorがactiveの間はconvertしない
      _actor.setState(COMPLETED);
    }
  }
  command(_actor){}
  // convertの内容が全く一緒。
  convert(_actor){
    if(_actor.getPauseTime() > 0){
      _actor.currentFlow = this.convertList[2];
    }else{
      console.log('complete. %d', frameCount);
      let flag = _actor.shiftCommand(); // 次の命令
      _actor.currentFlow = this.convertList[flag];
    }
  }
}

// Delayはタイミングをずらして指示
class commandDelay extends commandAct{
  constructor(){
    super();
    this.delay = 1;
  }
  initialize(_actor){
    this.delay = _actor.commandArray[_actor.currentIndex]['delay'];
    _actor.timer.setting(_actor.troop.length * this.delay);
  }
  command(_actor){
    let cnt = _actor.timer.getCnt();
    if(cnt % this.delay === 0){ _actor.command(_actor.troop[Math.floor(cnt / this.delay) - 1]); }
  }
}

// Allはまとめて指示
class commandAll extends commandAct{
  constructor(){
    super();
  }
  command(_actor){
    _actor.troop.forEach(function(a){ _actor.command(a); }) // troopの各メンバーに命令
  }
}

// commandは辞書の配列を使っていろいろ指示するもの（その中にはactivateも入っている）

// 待機命令
// 35番がactiveの間は何もしない
// 35番がnon-activeになったら60カウントしたのちconvert. commanderのデフォルト。
class waiting extends flow{
  constructor(){
    super();
    this.pauseTime = 0; // 可変にする
  }
  initialize(_actor){
    this.pauseTime = _actor.getPauseTime();
    _actor.timer.setting(this.pauseTime);
  }
  execute(_actor){
    _actor.timer.step();
    if(_actor.timer.getCnt() === this.pauseTime){ _actor.setState(COMPLETED); }
  }
  convert(_actor){
    console.log('complete. %d', frameCount);
    let flag = _actor.shiftCommand(); // 次の命令
    _actor.currentFlow = this.convertList[flag];
  }
}

// 準備のためのフロー（一番最初にcommanderに設定する）
class preparation extends flow{
  constructor(){
    super();
  }
  execute(_actor){
    // SIZE個の, 始点が円周上にあるベクトルを作る
    let vecs = getVector(arSinSeq(0, 2 * PI / SIZE, SIZE, 200, 300), arCosSeq(0, 2 * PI / SIZE, SIZE, 200, 300));
    // troopにメンバーを登録
    for(let i = 0; i < SIZE; i++){
      let _flow = new constantFlow(vecs[i], createVector(300, 300));
      let member = new massCell(_flow, 0, 0);
      _actor.registMember(member);
    }
    // アンカーを設定
    _actor.anchor = _actor.troop[_actor.troop.length - 1]; // 最終演技者
    // このあとのcommanderのこなすフローを生成してさらに接続を設定
    let cDelay = new commandDelay();
    let cAll = new commandAll();
    let wait = new waiting();
    cDelay.convertList = [cDelay, cAll, wait];
    cAll.convertList = [cDelay, cAll, wait];
    wait.convertList = [cDelay, cAll];
    // commandArrayは既に作ってある
    this.convertList = [cDelay, cAll]; // 自身のconvertList.
    _actor.setState(COMPLETED); // 準備完了。うん、しっくりくるね！
  }
  convert(_actor){
    // delayの値に応じて最初のパフォーマンスを決める
    let delay = _actor.commandArray[_actor.currentIndex]['delay'];
    if(delay > 0){ _actor.currentFlow = this.convertList[0]; }
    else{ _actor.currentFlow = this.convertList[1]; }
  }
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
    }
    if(this.state === IN_PROGRESS){
      this.in_progressAction();
    }
    if(this.state === COMPLETED){
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
    this.visual = new figure(colorId, figureId); // 色は変わるけどね
    this.currentHue = 0; // 現在のhue.
		//this.diffAngle = 0; // イージング用
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
    this.graphic = createGraphics(40, 40);
    this.rotation = 0;
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
  constructor(f = undefined){
    super(f);
    this.commandArray = commander.getCommandArray(); // すべての演技に関する情報を有する辞書配列
    this.currentIndex = 0; // 演技の番号みたいなやつ
    //this.troop = troop; // メインアクターの配列(troop)
    //this.anchor = this.troop[this.troop.length - 1]; // アンカー（最後に演技する人）
    this.troop = []; // メンバーの配列
    this.anchor; // 最後に演技を終える人
  }
  registMember(_actor){  // メンバー登録
    this.troop.push(_actor);
  }
  setCommandArray(dictArray){
    this.commandArray = dictArray;
  }
  in_progressAction(){
    this.troop.forEach(function(a){ a.update(); })
    this.currentFlow.execute(this);
    backgroundColor = color(this.anchor.currentHue, 40, 100);
  }
  shiftCommand(){
    let index = (this.currentIndex + 1) % this.commandArray.length;
    this.currentIndex = index; // せってい
    let delay = this.commandArray[this.currentIndex]['delay'];
    return (delay > 0 ? 0 : 1); // delay>0なら0を返す. でなければ1を返す。
  }
  getPauseTime(){
    return this.commandArray[this.currentIndex]['pauseTime'];
  }
  display(){
    this.troop.forEach(function(a){ a.display(); })
  }
  command(member){
    // targetというか各メンバーに
    let dict = this.commandArray[this.currentIndex];
    let vecs = dict['infoVectorArray'];
    //console.log(vecs);
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
      v = vecs[member.index - 1]; // indexの番号が1つずれているので注意する
    }
    member.currentFlow.setting(member.pos, v, dict['actTime'], member.currentHue, dict['nextHue']); // fromを現在位置、toを目的地に設定
    member.changeFigure(dict['figureId']); // 姿を変える
    member.activate(); // 起動。
  }
  static getCommandArray(){
    // dictの配列を返す。これはcommanderにセットされる。
    // あとは然るべき規則でここに書き込めば勝手にパターンを次々と演じてくれる。
    let dictArray = [];
    // まず中心にぎゅっ。
    let vecs = getVector(constSeq(300, SIZE), constSeq(300, SIZE));
    let pattern = commander.getDirectCommand(0, 0, 60, vecs, 7, 2);
    dictArray.push(pattern);
    // まずは右下かぎ型.
    vecs = getPatternVector(10);
    pattern = commander.getDirectCommand(2, 0, 40, vecs, 7, 5);
    dictArray.push(pattern);
    // 次に正方形.
    vecs = getPatternVector(0);
    pattern = commander.getDirectCommand(3, 0, 50, vecs, 0, 10);
    dictArray.push(pattern);
    // 下向き扇状
    vecs = getPatternVector(9);
    pattern = commander.getDirectCommand(2, 0, 50, vecs, 0, 13);
    dictArray.push(pattern);
    // 星型。
    vecs = getPatternVector(1);
    pattern = commander.getDirectCommand(4, 0, 50, vecs, 1, 17);
    dictArray.push(pattern);
    // 十字型。
    vecs = getPatternVector(2);
    pattern = commander.getDirectCommand(2, 0, 40, vecs, 1, 26);
    dictArray.push(pattern);
    // 三角形。
    vecs = getPatternVector(3);
    pattern = commander.getDirectCommand(1, 0, 50, vecs, 2, 35);
    dictArray.push(pattern);
    // 右向き扇状
    vecs = getPatternVector(7);
    pattern = commander.getDirectCommand(2, 0, 50, vecs, 2, 43);
    dictArray.push(pattern);
    // ひし形4つ
    vecs = getPatternVector(4);
    pattern = commander.getDirectCommand(2, 0, 50, vecs, 3, 52);
    dictArray.push(pattern);
    // 左向き扇状
    vecs = getPatternVector(8);
    pattern = commander.getDirectCommand(2, 0, 50, vecs, 3, 58);
    dictArray.push(pattern);
    // 六角形
    vecs = getPatternVector(5);
    pattern = commander.getDirectCommand(2, 0, 50, vecs, 4, 64);
    dictArray.push(pattern);
    // たて直線
    vecs = getVector(constSeq(300, 36), arSeq(125, 10, 36));
    pattern = commander.getDirectCommand(2, 0, 60, vecs, 4, 72);
    dictArray.push(pattern);
    // らせん
    vecs = getPatternVector(6);
    pattern = commander.getDirectCommand(1, 0, 50, vecs, 5, 80);
    dictArray.push(pattern);
    // よこ直線
    vecs = getVector(arSeq(125, 10, 36), constSeq(300, 36));
    pattern = commander.getDirectCommand(1, 0, 50, vecs, 5, 90);
    dictArray.push(pattern);
    // 最後は円形配置
    vecs = getVector(arSinSeq(0, 2 * PI / SIZE, SIZE, 150, 300), arCosSeq(0, 2 * PI / SIZE, SIZE, 150, 300));
    pattern = commander.getDirectCommand(1, 0, 50, vecs, 6, 100);
    dictArray.push(pattern);
		// 1ずつずらす
		vecs = getVector(arSinSeq(1, 2 * PI / 36, 36, 150, 300), arCosSeq(1, 2 * PI / 36, 36, 150, 300));
		pattern = commander.getDirectCommand(0, 0, 180, vecs, 5, 80);
		dictArray.push(pattern);
		// 5ずつずらす
		vecs = getVector(arSinSeq(6, 10 * PI / 36, 36, 150, 300), arCosSeq(6, 10 * PI / 36, 36, 150, 300));
		pattern = commander.getDirectCommand(0, 0, 180, vecs, 4, 64);
		dictArray.push(pattern);
		// 7ずつずらす
		vecs = getVector(arSinSeq(13, 14 * PI / 36, 36, 150, 300), arCosSeq(13, 14 * PI / 36, 36, 150, 300));
		pattern = commander.getDirectCommand(0, 0, 180, vecs, 3, 52);
		dictArray.push(pattern);
		// 11ずつずらす
		vecs = getVector(arSinSeq(24, 22 * PI / 36, 36, 150, 300), arCosSeq(24, 22 * PI / 36, 36, 150, 300));
		pattern = commander.getDirectCommand(0, 0, 180, vecs, 2, 35);
		dictArray.push(pattern);
		// 13ずつずらす
		vecs = getVector(arSinSeq(37, 26 * PI / 36, 36, 150, 300), arCosSeq(37, 26 * PI / 36, 36, 150, 300));
		pattern = commander.getDirectCommand(0, 0, 180, vecs, 1, 17);
		dictArray.push(pattern);
		// 17ずつずらす
		vecs = getVector(arSinSeq(54, 34 * PI / 36, 36, 150, 300), arCosSeq(54, 34 * PI / 36, 36, 150, 300));
		pattern = commander.getDirectCommand(0, 0, 180, vecs, 0, 10);
		dictArray.push(pattern);

    return dictArray;
  }
  static getDirectCommand(delay, pauseTime, actTime, infoVectorArray, figureId, nextHue){
    let dict = {};
    commander.preSetting(dict, delay, pauseTime, actTime, figureId, nextHue);
    dict['mode'] = 'direct';
    dict['infoVectorArray'] = infoVectorArray;
    return dict;
  }
  static getRectCommand(delay, pauseTime, actTime, left, up, right, down, figureId, nextHue){
    let dict = {};
    commander.preSetting(dict, delay, pauseTime, actTime, figureId, nextHue);
    dict['mode'] = 'rect'
    dict['infoVectorArray'] = getVector([left, right], [up, down]);
    return dict;
  }
  static getEllipseCommand(delay, pauseTime, actTime, centerX, centerY, radiusX, radiusY, figureId, nextHue){
    let dict = {};
    commander.preSetting(dict, delay, pauseTime, actTime, figureId, nextHue);
    dict['mode'] = 'ellipse';
    dict['infoVectorArray'] = getVector([centerX, radiusX], [centerY, radiusY]);
    return dict;
  }
  static getBandCommand(delay, pauseTime, actTime, minRadius, maxRadius, minAngle, maxAngle, centerX, centerY, figureId, nextHue){
    let dict = {};
    commander.preSetting(dict, delay, pauseTime, actTime, figureId, nextHue);
    dict['mode'] = 'band';
    dict['infoVectorArray'] = getVector([minRadius, minAngle, centerX], [maxRadius, maxAngle, centerY]);
    return dict;
  }
  static preSetting(dict, delay, pauseTime, actTime, figureId, nextHue){
    //if(delayValue > 0){ dict['delay'] = true; dict['interval'] = delayValue; }else{ dict['delay'] = false; }
    dict['delay'] = delay; // intervalは廃止してdelayの0か正かで判断することに。
    dict['pauseTime'] = pauseTime;
    dict['actTime'] = actTime;
    dict['figureId'] = figureId;
    dict['nextHue'] = nextHue;
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
  }else if(patternIndex === 7){
    // 右向き扇状
    let vecs = [];
    let upperAngle = -PI / (2 * SIZE);
    let lowerAngle = PI / (2 * SIZE);
    for(let k = 0; k < SIZE / 2; k++){
      vecs.push(createVector(300 + 200 * cos(upperAngle), 300 + 200 * sin(upperAngle)));
      vecs.push(createVector(300 + 200 * cos(lowerAngle), 300 + 200 * sin(lowerAngle)));
      upperAngle -= PI / SIZE;
      lowerAngle += PI / SIZE;
    }
    return vecs;
  }else if(patternIndex === 8){
    // 左向き扇状
    let vecs = [];
    let upperAngle = -PI / (2 * SIZE);
    let lowerAngle = PI / (2 * SIZE);
    for(let k = 0; k < SIZE / 2; k++){
      vecs.push(createVector(300 - 200 * cos(upperAngle), 300 + 200 * sin(upperAngle)));
      vecs.push(createVector(300 - 200 * cos(lowerAngle), 300 + 200 * sin(lowerAngle)));
      upperAngle -= PI / SIZE;
      lowerAngle += PI / SIZE;
    }
    return vecs;
  }else if(patternIndex === 9){
    // 下向き扇状
    let vecs = [];
    let upperAngle = -PI / (2 * SIZE);
    let lowerAngle = PI / (2 * SIZE);
    for(let k = 0; k < SIZE / 2; k++){
      vecs.push(createVector(300 + 200 * sin(upperAngle), 300 + 200 * cos(upperAngle)));
      vecs.push(createVector(300 + 200 * sin(lowerAngle), 300 + 200 * cos(lowerAngle)));
      upperAngle -= PI / SIZE;
      lowerAngle += PI / SIZE;
    }
    return vecs;
  }else if(patternIndex === 10){
    // 右下かぎ型
    let vecs = [];
    let downXValue = 470;
    let rightYValue = 470;
    for(let k = 0; k < SIZE / 2; k++){
      vecs.push(createVector(downXValue, 480));
      vecs.push(createVector(480, rightYValue));
      downXValue -= 20;
      rightYValue -= 20;
    }
    return vecs;
  }
}
