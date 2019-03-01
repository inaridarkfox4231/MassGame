// flowベースでの書き換えをする実験～～
// 応用：MassGame.
// リセット


'use strict';
let all; // 全体
let backgroundColor;
let palette; // カラーパレット

const COLOR_NUM = 7;

const IDLE = 0;
const IN_PROGRESS = 1;
const COMPLETED = 2;

function setup(){
  createCanvas(600, 600);
  // palette HSBでやってみたい
  colorMode(HSB, 100);
  backgroundColor = color(63, 20, 100);
  palette = [color(0, 100, 100), color(10, 100, 100), color(17, 100, 100), color(35, 100, 100), color(52, 100, 100), color(64, 100, 100), color(80, 100, 100)];
  all = new entity();
  all.initialize();
}

function draw(){
  background(backgroundColor);
  all.update(); // updateする
  all.draw();
}

function mouseClicked(){
  if(mouseX < 40 && mouseY < 80){
    if(mouseY < 40){ noLoop(); }
    else{ loop(); }
    return;
  }
}

// 簡単なものでいいです（簡単になりすぎ）
class counter{
  constructor(){
    this.cnt = 0;
  }
  getCnt(){ return this.cnt; }
  reset(){ this.cnt = 0; }
  step(diff = 1){
    this.cnt += diff; // カウンターはマイナスでもいいんだよ
    return false; // 統一性
  }
} // limitは廃止（使う側が何とかしろ）（てかもうクラスにする意味ないやんな）

// 全部フロー。ただし複雑なconvertはハブにおまかせ～色とかいじれるといいね。今位置情報しかいじってない・・
class flow{
  constructor(){
    this.index = flow.index++;
    this.convertList = []; // 次のflowのリスト
    this.nextFlowIndex = -1; // デフォルトは-1, ランダムの意味
  }
  initialize(_actor){} // stateを送らせるのはactor.
  execute(_actor){
    _actor.setState(COMPLETED) // デフォルトはstateをCOMPLETEDにするだけ。こっちはタイミング決めるのはflowですから。
  }
  update(){}  // update.
  convert(_actor){
    //_actor.setState(IDLE); // IDLEにするのはactor.
    if(this.convertList.length === 0){
      _actor.setFlow(undefined);
      _actor.inActivate(); // 次のフローがなければすることはないです。止まります。再びあれするならflowをsetしてね。
      return;
    }
    if(this.nextFlowIndex < 0){ // -1はランダムフラグ
      _actor.setFlow(this.convertList[randomInt(this.convertList.length)]);
    }else{
      _actor.setFlow(this.convertList[this.nextFlowIndex]);
    } // 次のflowが与えられるならそのままisActive継続、次の処理へ。
    // わざとこのあとinActivateにして特定の条件下でactivateさせても面白そう。
  }
}

// 一定のspanでA地点からB地点まで。あると非常ーーーーーーーーーに便利。
class constantFlow extends flow{
  constructor(from, to, spanTime){
    super();
    this.from = from;
    this.to = to;
    this.spanTime = spanTime;
  }
  initialize(_actor){
    _actor.setPos(this.from.x, this.from.y); // 初期位置与える。
    _actor.timer.reset();
  }
  getProgress(_actor){
    _actor.timer.step(); // 1ずつ増やす
    let cnt = _actor.timer.getCnt();
    if(cnt >= this.spanTime){ return 1; } // 1を返す
    return cnt / this.spanTime; // 1を返すときcompleteになるよう修正
  }
  execute(_actor){
    // 直線
    let progress = this.getProgress(_actor);
    _actor.setPos(map(progress, 0, 1, this.from.x, this.to.x), map(progress, 0, 1, this.from.y, this.to.y));
    if(progress === 1){ _actor.setState(COMPLETED); }
  }
}

flow.index = 0;

// 純粋なactorはflowをこなすだけ、言われたことをやるだけの存在
class actor{
  constructor(f = undefined){
    // colorIdはそのうち廃止してビジュアルをセッティングするなんかつくる
    this.index = actor.index++;
    this.currentFlow = f;
    this.timer = new counter();
    this.isActive = false; // デフォルトをfalseにしてプログラムのインプット時にtrueにする作戦で行く
    this.state = IDLE; // 状態（IDLE, IN_PROGRESS, COMPLETED）
  }
  activate(){ this.isActive = true; } // isActiveがfalse⇔updateしない。シンプル。これを目指している。
  inActivate(){ this.isActive = false; } // 冗長だけどコードの可読性の為に両方用意する。
  setState(newState){ this.state = newState; } // stateをチェンジ
  setFlow(newFlow){ this.currentFlow = newFlow; } // flowをセットする
  update(){
    if(!this.isActive){ return; } // activeじゃないなら何もすることはない。
    // initialGimicが入るのはここ
    if(this.state === IDLE){
      this.idleAction();
    }
    if(this.state === IN_PROGRESS){
      this.in_progressAction();
    }else if(this.state === COMPLETED){
      this.completeAction();
    }
    // completeGimicが入るのはここ。
    // IN_PROGRESSのあとすぐにCOMPLETEDにしないことでGimicをはさむ余地を与える.
  }
  idleAction(){
    this.currentFlow.initialize(this); // flowに初期化してもらう
    this.setState(IN_PROGRESS);
  }
  in_progressAction(){
    this.currentFlow.execute(this); // 実行！この中で適切なタイミングでsetState(COMPLETED)してもらうの
  }
  completeAction(){
    this.setState(IDLE);
    this.currentFlow.convert(this); // ここで行先が定められないと[IDLEかつundefined]いわゆるニートになります（おい）
  }
  display(){};
}

// 色や形を与えられたactor. ビジュアル的に分かりやすいので今はこれしか使ってない。
class movingActor extends actor{
  constructor(f = undefined, speed = 1, colorId = 0, figureId = 0){
    super(f);
    this.pos = createVector(-100, -100); // flowが始まれば勝手に・・って感じ。
    this.myColor = color(hue(palette[colorId]), saturation(palette[colorId]), 100); // 自分の色。
    this.visual = new rollingFigure(this.myColor, figureId); // 回転する図形
    this.speed = speed; // 今の状況だとスピードも要るかな・・クラスとして分離するかは要相談（composition）
    this.visible = true;
  }
  setPos(x, y){ // そのうちゲーム作ってみるとかなったら全部これ経由しないとね。
    this.pos.x = x;
    this.pos.y = y; // 今更だけどposをセットする関数（ほんとに今更）
  }
  getPos(){
    return this.pos; // ゲッター
  }
  setSpeed(newSpeed){
    this.speed = newSpeed;
  }
  // 今ここにsetVisualを作りたい。色id, サイズとか形とか。
  setVisual(newColorId, newFigureId){
    this.visual.reset(newColorId, newFigureId);
  }
  show(){ this.visible = true; }   // 姿を現す
  hide(){ this.visible = false; }  // 消える
  display(){
    if(!this.visible){ return; }
    this.visual.display(this.pos);
  }
}

// 便宜上、位置情報オンリーのactor作りますか。
class controller extends actor{
  constructor(f = undefined, x = 0, y = 0, speed = 1){
    super(f);
    this.pos = createVector(x, y);
    this.speed = speed;
  }
  setPos(x, y){ // そのうちゲーム作ってみるとかなったら全部これ経由しないとね。
    this.pos.x = x;
    this.pos.y = y; // 今更だけどposをセットする関数（ほんとに今更）
  }
  getPos(){
    return this.pos; // ゲッター
  }
  setSpeed(newSpeed){
    this.speed = newSpeed;
  }
}

// 条件1: myColorという名前のcolorオブジェクトを持ってる。
// 条件2: changeColor(x, y, z, w)という色変更の関数を持ってる。
// 背景が単色ならクラスの構成工夫すればこれで・・
class colorController extends controller{
  // カラーオブジェクトを有する。色変更。まとめて変えることも。
  constructor(f = undefined, x = 0, y = 0, speed = 1){
    super(f, x, y, speed);
    this.targetArray = []; // myColorという名前のcolorオブジェクトを持ってることが条件。
    // targetはchangeColor(x, y, z, w)という名前の関数を持ってる必要がある。これを呼び出すことになる。
    // モードの概念を加えれば、2つまでいじれる、かな・・・
  }
  in_progressAction(){
    let thirdValue = brightness(this.targetArray[0].myColor);
    let fourceValue = alpha(this.targetArray[0].myColor);
    this.currentFlow.execute(this); // 実行！この中でsetState(COMPLETED)してもらう
    this.targetArray.forEach(function(target){ target.changeColor(this.pos.x, this.pos.y, thirdValue, fourceValue); }, this)
  }
  addTarget(targetColor){
    this.targetArray.push(targetColor);
  }
  addMultiTarget(targetColorArray){
    targetColorArray.forEach(function(t){ this.addTarget(t); }, this);
  }
  // removeとかはまた今度
}

class backgroundColorController extends controller{
  // 背景色を変える
  constructor(f = undefined, x = 0, y = 0, speed = 1){
    super(f, x, y, speed);
  }
  in_progressAction(){
    let thirdValue = brightness(backgroundColor);
    let fourceValue = alpha(backgroundColor);
    this.currentFlow.execute(this); // 実行！この中でsetState(COMPLETED)してもらう
    backgroundColor = color(this.pos.x, this.pos.y, thirdValue, fourceValue);
  }
}

actor.index = 0; // 0, 1, 2, 3, ....

// figureクラスは図形の管理を行う
// やることは図形を表示させること、回転はオプションかな・・
// たとえばアイテムとか、オブジェクト的な奴とか。回転しないことも考慮しないとなぁ。
class figure{
  constructor(myColor, figureId = 0){
    this.myColor = myColor; // 色クラス使いまーす
    // shootingGameの方でもグラデ使いたいんだけどどうすっかなー、ま、どうにでもできるか。
    // こういうのどうにでもできる強さがあればいいんじゃない？はやいとこ色々作りたいよ。
    this.figureId = figureId; // 図形のタイプ
    this.graphic = createGraphics(40, 40);
    //inputGraphic(this.graphic, colorId);
    figure.setGraphic(this.graphic, this.myColor, figureId);
  }
  reset(newColor, newFigureId){
    figure.setGraphic(this.graphic, newColor, newFigureId);
  }
  changeColor(x, y, z, w){ // 色が変わるといいね（え？）
    this.myColor = color(x, y, z, w);
    figure.setGraphic(this.graphic, this.myColor, this.figureId); // update.
  }
  changeFigure(newFigureId){ // 形が変わる
    this.figureId = newFigureId;
    //console.log(this.figureId);
    figure.setGraphic(this.graphic, this.myColor, this.figureId); // update.
  }
  static setGraphic(img, myColor, figureId = 0){
    // 形のバリエーション増やす
    img.clear();
    img.noStroke();
    img.fill(myColor);
    if(figureId === 0){
      // 正方形
      img.rect(10, 10, 20, 20);
      img.fill(255);
      img.rect(15, 15, 2, 5);
      img.rect(23, 15, 2, 5);
    }else if(figureId === 1){
      // 星型
      let outer = rotationSeq(0, -12, 2 * PI / 5, 5, 20, 20);
      let inner = rotationSeq(0, 6, 2 * PI / 5, 5, 20, 20);
      for(let i = 0; i < 5; i++){
        let k = (i + 2) % 5;
        let l = (i + 3) % 5;
        img.quad(outer[i].x, outer[i].y, inner[k].x, inner[k].y, 20, 20, inner[l].x, inner[l].y);
      }
      img.fill(255);
      img.rect(15, 17, 2, 5);
      img.rect(23, 17, 2, 5);
    }else if(figureId === 2){
      // 三角形
      img.triangle(20, 20 - 24 / Math.sqrt(3), 32, 20 + (12 / Math.sqrt(3)), 8, 20 + (12 / Math.sqrt(3)));
      img.fill(255);
      img.rect(15, 17, 2, 5);
      img.rect(23, 17, 2, 5);
    }else if(figureId === 3){
      // ひしがた
      img.quad(28, 20, 20, 20 - 10 * Math.sqrt(3), 12, 20, 20, 20 + 10 * Math.sqrt(3));
      img.fill(255);
      img.rect(15, 17, 2, 5);
      img.rect(23, 17, 2, 5);
    }else if(figureId === 4){
      // 六角形
      img.quad(32, 20, 26, 20 - 6 * Math.sqrt(3), 14, 20 - 6 * Math.sqrt(3), 8, 20);
      img.quad(32, 20, 26, 20 + 6 * Math.sqrt(3), 14, 20 + 6 * Math.sqrt(3), 8, 20);
      img.fill(255);
      img.rect(15, 17, 2, 5);
      img.rect(23, 17, 2, 5);
    }else if(figureId === 5){
      // なんか頭ちょろってやつ
      img.ellipse(20, 20, 20, 20);
      img.triangle(20, 20, 20 - 5 * Math.sqrt(3), 15, 20, 0);
      img.fill(255);
      img.rect(15, 17, 2, 5);
      img.rect(23, 17, 2, 5);
    }else if(figureId === 6){
      // 逆三角形
      img.triangle(20, 20 + 24 / Math.sqrt(3), 32, 20 - (12 / Math.sqrt(3)), 8, 20 - (12 / Math.sqrt(3)));
      img.fill(255);
      img.rect(15, 17, 2, 5);
      img.rect(23, 17, 2, 5);
    }else if(figureId === 7){
      // デフォルト用の円形
      img.ellipse(20, 20, 20, 20);
      img.fill(255);
      img.rect(15, 17, 2, 5);
      img.rect(23, 17, 2, 5);
    }
  }
  display(pos){
    push();
    translate(pos.x, pos.y);
    image(this.graphic, -20, -20); // 20x20に合わせる
    pop();
  }
}

// というわけでrollingFigure. でもこれじゃswingFigureだな・・swing楽しいけどね。
class rollingFigure extends figure{
  constructor(colorId, figureId = 1){
    super(colorId, figureId);
    //this.rotation = random(2 * PI);
    this.rotation = 0; // 0にしよー
  }
  // updateはflowを定めてたとえば小さくなって消えるとか出来るようになるんだけどね（まだ）
  // もしupdateするならactorのupdateに書くことになりそうだけど。
  display(pos){
    push();
    translate(pos.x, pos.y);
    this.rotation += 0.1; // これも本来はfigureのupdateに書かないと・・基本的にupdate→drawの原則は破っちゃいけない
    //rotate(this.rotation);
    rotate((PI / 8) * sin(this.rotation));
    image(this.graphic, -20, -20); // 20x20に合わせる
    pop();
  }
}

class entity{
  constructor(){
    this.base = createGraphics(width, height);
    this.flows = [];
    this.baseFlows = []; // baseのflowの配列
    this.actors = [];
  }
  getFlow(givenIndex){
    for(let i = 0; i < this.flows.length; i++){
      if(this.flows[i].index === givenIndex){ return this.flows[i]; break; }
    }
    return undefined; // forEachだとreturnで終わってくれないことを知った
  }
  getActor(givenIndex){
    for(let i = 0; i < this.actors.length; i++){
      if(this.actors[i].index === givenIndex){ return this.actors[i]; break; }
    }
    return undefined;
  }
  initialize(){
    createPattern(); // MassGameをCreateする
    this.baseFlows.forEach(function(f){ f.display(this.base); }, this); // ベースグラフの初期化（addは毎ターン）
  }
  reset(){
    this.base.clear();
    this.flows = [];
    this.baseFlows = []; // baseのflowの配列
    this.actors = [];
    flow.index = 0; // 通し番号リセット
    actor.index = 0;
  }
  activateAll(){ // まとめてactivate.
    this.actors.forEach(function(_actor){ console.log(_actor); _actor.activate(); }, this);
    // 一部だけしたくないならこの後個別にinActivateするとか？
  }
  registActor(flowIds, speeds, colorIds){
    // flowはメソッドでidから取得。
    for(let i = 0; i < flowIds.length; i++){
      let f = this.getFlow(flowIds[i]);
      let newActor = new movingActor(f, speeds[i], colorIds[i])
      this.actors.push(newActor);
    }
  }
  connect(index, nextIndexList){
    // index番のflowの行先リストをnextIndexListによって作る
    nextIndexList.forEach(function(nextIndex){
      this.getFlow(index).convertList.push(this.getFlow(nextIndex));
    }, this)
  }
  connectMulti(indexList, nextIndexListArray){
    // IndexListに書かれたindexのflowにまとめて指定する
    // たとえば[6, 7, 8], [[2], [3], [4, 5]] ってやると6に2, 7に3, 8に4, 5が指定される
    for(let i = 0; i < indexList.length; i++){
      this.connect(indexList[i], nextIndexListArray[i]);
    }
  }
  update(){
    this.actors.forEach(function(_actor){
      _actor.update(); // flowもupdateしたいんだけどね
    })
  }
  draw(){
    image(this.base, 0, 0);
    this.actors.forEach(function(_actor){ // actorの描画
      _actor.display();
    })
  }
}

// --------------------------------------------------------------------------------------- //
function createPattern(){
  let vecs = getVector([100, 200, 300], [300, 200, 400]);
  let f1 = new constantFlow(vecs[0], vecs[1], 120);
  let f2 = new constantFlow(vecs[1], vecs[2], 40);
  all.flows.push(f1);
  all.flows.push(f2);
  all.connectMulti([0], [[1]]);
  all.registActor([0], [2], [0]);
  all.activateAll();
}
// ---------------------------------------------------------- //
// MassGame用のベクトルの配列を出す関数
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
    // 円周（最後）
    return getVector(arSinSeq(0, 2 * PI / 36, 36, 200, 300), arCosSeq(0, 2 * PI / 36, 36, 200, 300));
  }
}

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

// OrbitalFlow用の辞書作るよー
function getOrbitalFlow(vecs, fromIds, toIds, typename, allOne = true){
  let paramSet = [];
  for(let i = 0; i < fromIds.length; i++){
    let dict = {type: typename, from: vecs[fromIds[i]], to: vecs[toIds[i]]};
    if(allOne){ dict['factor'] = 1; } // factorをすべて1にするオプション
    paramSet.push(dict);
  }
  return paramSet;
}

// constantFlow用の辞書配列作成関数
function getConstantFlow(vecs, fromIds, toIds, spanTimes){
  let paramSet = [];
  for(let i = 0; i < fromIds.length; i++){
    let dict = {type: 'constant', from: vecs[fromIds[i]], to: vecs[toIds[i]], spanTime: spanTimes[i]}
    paramSet.push(dict);
  }
  return paramSet;
}
