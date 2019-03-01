// flowベースでの書き換えをする実験～～
// 応用：MassGame.
// 最後、initializeの順番で問題が発生したけど、
// あれはstraightFlowで距離を近似計算してて、それで誤差が発生して
// 到達するタイミングがずれて、そのあと全部ズレちゃったのが原因だった。
// 時間管理に優れたorbitalEasingFlowに取り替えたらうまくいった。ふぅ・・

'use strict';
let all; // 全体
let backgroundColor;
let palette; // カラーパレット

// orientedMuzzle用。parallelは[0,1]→[0,1]で、normalは[0,1]上で0から0へみたいな。
let parallelFunc = [funcP0, funcP1, funcP2, funcP3, funcP4, funcP5, funcP6, funcP7, funcP8, funcP9, funcP10];
let normalFunc = [funcN0];

const PATTERN_NUM = 1;
const COLOR_NUM = 7;

const DIRECT = 0; // orientedFlowの位置指定、直接指定。
const DIFF = 1 // 差分指定。

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
  console.log(frameCount);
}

function draw(){
  background(backgroundColor);
  all.update(); // updateする
  all.initialGimicAction();  // 初期化前ギミックチェック
  all.completeGimicAction(); // 完了時ギミックチェック
  all.draw();
}
// updateしてからGimicをチェックすると、例えばこういうことが起きる。
// まず、completeGimicでinActivateするやつを作ると、それを踏んだactorの動きが止まる。
// インターバルの後、それを解放する何かしらのGimicが発動したとすると、その優先度が最後（後ろの方に配置する）なら、
// そのあとすぐupdateに行くから解放される。これが逆だと、解放した直後に再びGimicが発動して
// 動きが止まってしまうので、配置順がすごく大事。

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
  display(gr){} // 一応書いておかないと不都合が生じそうだ
}

class waitFlow extends flow{
  // ただ単に一定数カウントを進めるだけ。いわゆるアイドリングってやつね。
  constructor(span){
    super();
    this.span = span; // どれくらい進めるか
  }
  initialize(_actor){ _actor.timer.reset(); }
  execute(_actor){
    _actor.timer.step(1);
    if(_actor.timer.getCnt() >= this.span){
      console.log("%d for waitMotion.", frameCount);
      _actor.setState(COMPLETED);
    } // limitって書いちゃった
  }
  setting(dict){
    this.span = dict['span'];
  }
}

// hubです。位置情報とかは基本なし（あることもある）。複雑なflowの接続を一手に引き受けます。
class assembleHub extends flow{
  // いくつか集まったら解放される。
  constructor(limit){
    super();
    this.limit = limit;
    this.volume = 0; // lim-1→limのときtrue, 1→0のときfalse.
    this.open = false; // 出口が開いてるかどうかのフラグ
  }
  initialize(_actor){
    this.volume++; // これだけ。
    if(this.volume >= this.limit){ this.open = true; } // limitに達したら開くよ
  }
  execute(_actor){
    if(this.open){
      _actor.setState(COMPLETED);
      this.volume--; // 出て行ったら減らす
      if(this.volume === 0){ this.open = false; } // 0になったタイミングで閉じる
    } // 開いてるなら行って良し
  }
}
class rectifierHub extends flow{
  // 整流器。intervalごとに1匹通す。回転ずしで使えそう。あとはディレイとかかなぁ・・
  constructor(interval){
    super();
    this.timer = new counter();
    this.interval = interval;
    this.open = true;
  }
  execute(_actor){
    if(this.interval === 0){ console.log("%d for rectifier", frameCount); _actor.setState(COMPLETED); return; } // intervalに0を入れると無効化できる
    if(this.open){
      console.log("%d for rectifier", frameCount);
      _actor.setState(COMPLETED);
      this.open = false;
    }
  }
  update(){
    if(this.interval === 0){ return; }
    if(!this.open){ this.timer.step(); } // closeのときだけ進める
    if(this.timer.getCnt() >= this.interval){ this.open = true; this.timer.reset(); }
  }
  setting(dict){
    this.interval = dict['interval'];
    this.open = true; // 再設定！
  }
}

// assembleHub使えばinitializeのタイミングを同期させることができる・・その手もあったけどね。
// まあ、使い分けよ。

// generateHubは特定のフローに・・あーどうしよかな。んー。。
// こういうの、なんか別の概念が必要な気がする。convertしないからさ。違うでしょって話。

// 始点と終点とspanからなりどこかからどこかへ行くことが目的のFlow.
// 対象はmovingActorを想定しているのでposとか持ってないとエラーになります。
class orbitalFlow extends flow{
  constructor(from, to){
    super();
    this.from = from; // スタートの位置ベクトル
    this.to = to; // ゴールの位置ベクトル
    this.span;
  }
  getSpan(){ return this.span; }
  initialize(_actor){
    _actor.setPos(this.from.x, this.from.y); // 初期位置与える、基本これでactorの位置いじってる、今は。
    _actor.timer.reset(); // あ、resetでいいの・・
  }
  getProgress(_actor, diff){ // 進捗状況を取得（0~1）
    _actor.timer.step(diff); // 進める～
    let cnt = _actor.timer.getCnt(); // カウントゲットする～
    if(cnt >= this.span){
      cnt = this.span;
      _actor.setState(COMPLETED); // 処理終了のお知らせ
    }
    return cnt / this.span; // 進捗報告(％)
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
  display(gr){
    // 線を引くだけ
    gr.push();
    gr.strokeWeight(1.0);
    gr.line(this.from.x, this.from.y, this.to.x, this.to.y); // 普通の線
    gr.pop();
  }
}

class straightFlow extends orbitalFlow{
  constructor(from, to, factor){
    super(from, to);
    this.span = p5.Vector.dist(from, to);
    this.factor = factor; // 2なら2倍速とかそういう。
  }
  execute(_actor){
    // 直線
    let progress = this.getProgress(_actor, _actor.speed * this.factor); // 速くなったり遅くなったり
    _actor.setPos(map(progress, 0, 1, this.from.x, this.to.x), map(progress, 0, 1, this.from.y, this.to.y));
  }
  display(gr){
    // 線を引くだけです（ビジュアル要らないならなんかオプション付けてね・・あるいは、んー）
    gr.push();
    gr.strokeWeight(1.0);
    gr.line(this.from.x, this.from.y, this.to.x, this.to.y);
    gr.translate(this.from.x, this.from.y); // 矢印の根元に行って
    let directionVector = createVector(this.to.x - this.from.x, this.to.y - this.from.y);
    gr.rotate(directionVector.heading()); // ぐるんってやって行先をx軸正方向に置いて
    let arrowSize = 7;
    gr.translate(this.span - arrowSize, 0);
    gr.fill(0);
    gr.triangle(0, arrowSize / 2, 0, -arrowSize / 2, arrowSize, 0);
    gr.pop();
  }
}

// やっと本題に入れる。2時間もかかったよ。
// ratioが1より大きい時はずれ幅を直接長さで指定できるようにしたら面白そうね
class easingFlow extends flow{
  constructor(easeId_parallel, easeId_normal, ratio, spanTime){
    super();
    this.easeId_parallel = easeId_parallel;
    this.easeId_normal = easeId_normal;
    this.ratio = ratio // 垂直イージングの限界の距離に対する幅。
    this.spanTime = spanTime; // 所要フレーム数（デフォルトはやめた）
    // fromとかtoとかdiffVectorはactorごとに管理することにした。
    // あるいはbulletクラスを用意してそういうの持ってるようにすれば辞書要らないけどな
  }
  calcDiffVector(fromVector, toVector){ // 引数にしてしまおう
    let diffVector;
    if(this.ratio < 10){
      // 始点から終点へ向かうベクトルに比率を掛ける
      diffVector = createVector(toVector.y - fromVector.y, -(toVector.x - fromVector.x)).mult(this.ratio);
    }else{
      // 10以上の時は単位法線ベクトルにratioを掛ける
      let normalVector = createVector(toVector.y - fromVector.y, -(toVector.x - fromVector.x)).normalize();
      diffVector = normalVector.mult(this.ratio);
    }
    return diffVector;
  }
  getProgress(_actor){
    _actor.timer.step(); // 1ずつ増やす
    let cnt = _actor.timer.getCnt();
    if(cnt >= this.spanTime){ return 1; } // 1を返す
    return cnt / this.spanTime; // 1を返すときcompleteになるよう修正
  }
}
// 気付いたけど移動ってcntの進め方がすべてだからcntをキー操作でできるようにしたらそれで終わりなんじゃ・・？

// fromもtoもdiffVectorもこっちもち
// こっちはばりばりのorbitalFlowにイージングかけてる従来の形のflowなのです。
// だから根本的にあっちとは性質が異なるわけです。flowの情報だけで位置がすべて出るので。
// あっちはactorに依存しているがゆえに辞書とか必要なわけで。
class orbitalEasingFlow extends easingFlow{
  constructor(easeId_parallel, easeId_normal, ratio, spanTime, from, to){
    super(easeId_parallel, easeId_normal, ratio, spanTime)
    this.from = from;
    this.to = to; // fromとtoがベクトルで与えられる最も一般的な形
    this.diffVector;
    this.spanTime = spanTime // -1指定一旦やめよう。面倒くさくなってきた。固定でいいよ。
  }
  initialize(_actor){
    _actor.pos.set(this.from.x, this.from.y); // orbitalなので初期位置を設定
    this.diffVector = this.calcDiffVector(this.from, this.to); // fromとtoから計算
    _actor.timer.reset(); // spanTimeは具体的な指定以外禁止にしました（めんどい）
  }
  execute(_actor){
    // これも全く異なる、まあ基本は一緒だけど。
    let progress = this.getProgress(_actor); // 最後の処理のときは1が返る仕組み
    let easedProgress = parallelFunc[this.easeId_parallel](progress);
    let normalDiff = normalFunc[this.easeId_normal](progress);
    _actor.pos.x = map(easedProgress, 0, 1, this.from.x, this.to.x);
    _actor.pos.y = map(easedProgress, 0, 1, this.from.y, this.to.y);
    let easeVectorN = p5.Vector.mult(this.diffVector, normalDiff);
    _actor.pos.add(easeVectorN);
    if(progress === 1){
      _actor.setState(COMPLETED); // 1なら処理終了
    }
  }
}

// あー・・両方一緒だ。
// Gimicが要らないとは言ってない。使い方が間違ってるってだけ。

// 名前muzzleにしよう
// mode増やそう。revolveのモード。simple, rect, ellipse, fan, rotation, parallelの6種類
class orientedMuzzle extends easingFlow{
  constructor(easeId_parallel, easeId_normal, ratio, spanTime, kind, infoVectorArray, mode){
    super(easeId_parallel, easeId_normal, ratio, spanTime);
    this.kind = kind; // DIRECTなら目標地点ベース、DIFFならベクトルベース
    this.infoVectorArray = infoVectorArray; // 位置だったりベクトルの集合
    this.currentIndex = 0; // 0から始めようよ
    this.revolveMode = mode;
  }
  getInfoVector(){
    // 銃口を回す
    if(this.revolveMode === 0){ // simple. 1つ進める。reverseは配列を鏡写しで2倍にすればいい。([0, 1 ,2, 3, 2, 1]とか)
      let index = this.currentIndex; // この方がきれい。
      this.currentIndex = (this.currentIndex + 1) % this.infoVectorArray.length;
      return this.infoVectorArray[index];
    }else if(this.revolveMode === 1){ // rect.
      // [v0, v1]としてv0(左上)からv1(右下)までの範囲に指定する。DIRECTを想定。
      let leftUp = this.infoVectorArray[0];
      let rightDown = this.infoVectorArray[1];
      let x = leftUp.x + random(rightDown.x - leftUp.x);
      let y = leftUp.y + random(rightDown.y - leftUp.y);
      return createVector(x, y);
    }else if(this.revolveMode === 2){ // ellipse.
      // [v0, v1]としてv0中心、横半径v1[0], 縦半径v1[1]の範囲に指定する。DIRECTを想定。
      let centerVector = this.infoVectorArray[0];
      let sizeVector = this.infoVectorArray[1];
      let r = random(1);
      let theta = random(2 * PI);
      return createVector(centerVector.x + r * sizeVector.x * cos(theta), centerVector.y + r * sizeVector.y * sin(theta));
    }else if(this.revolveMode === 3){ // fan.
      // [v0, v1]としてv0からv1へ時計回りに回すとしてその間のどれかを返す。DIFFを想定。
      let v0 = this.infoVectorArray[0];
      let v1 = this.infoVectorArray[1];
      let theta0 = atan2(v0.y, v0.x);
      let theta1 = (atan2(v1.y, v1.x) + 2 * PI) % (2 * PI);
      let theta = theta0 + random(theta1 - theta0);
      let r = random((v0.mag() + v1.mag()) / 2);
      return createVector(r * cos(theta), r * sin(theta));
    }else if(this.revolveMode === 4){ // rotation.
      // [v0, v1, v2]としてv2は初期値v0で、v1=[r, θ]としてr倍、θ回転したものを作り続ける。
      let v0 = this.infoVectorArray[0];
      let v1 = this.infoVectorArray[1];
      let v2 = this.infoVectorArray[2];
      v2.mult(v1.x);
      let currentTheta = atan2(v2.y, v2.x);
      currentTheta += v1.y;
      v2.rotate(v1.y);
      return v2;
    }else if(this.revolveMode === 5){ // parallel;
      // [v0, v1, v2]としてv2は初期値v0で、v1 = [a, b]としてこれを足したものを作り続ける。
      let v0 = this.infoVectorArray[0];
      let v1 = this.infoVectorArray[1];
      let v2 = this.infoVectorArray[2];
      v2.add(v1);
      return v2;
    }
  }
  regist(_actor){
    // revolverGimicでこれを呼び出して先に登録しちゃう
    //_actor.info['from'] = _actor.pos;
    _actor.info['from'] = createVector(_actor.pos.x, _actor.pos.y);
    let infoVector = this.getInfoVector(); // ベクトルはここで計算する
    if(this.kind === DIRECT){
      _actor.info['to'] = infoVector;
    }else{
      let toVector = p5.Vector.add(_actor.pos, infoVector);
      _actor.info['to'] = toVector;
    }
    _actor.info['diffVector'] = this.calcDiffVector(_actor.pos, _actor.info['to']);
  }
  initialize(_actor){
    this.regist(_actor); // 登録
    _actor.timer.reset();
  }
  execute(_actor){
    let progress = this.getProgress(_actor); // progressを普通に取得。
		let easedProgress;
		// 汎用的でないコードを書きます(書かなくて済むように研究中)
		easedProgress = parallelFunc[this.easeId_parallel](progress);
    let normalDiff = normalFunc[this.easeId_normal](progress);

    let fromVector = _actor.info['from'];
    let toVector = _actor.info['to'];
    let diffVector = _actor.info['diffVector'];

    _actor.pos.x = map(easedProgress, 0, 1, fromVector.x, toVector.x);
    _actor.pos.y = map(easedProgress, 0, 1, fromVector.y, toVector.y);
    let easeVectorN = p5.Vector.mult(diffVector, normalDiff);
    _actor.pos.add(easeVectorN);
    if(progress === 1){
      // completeActionほしい
      _actor.setState(COMPLETED);
      // 情報を削除。確かにこれはconvertにもexecuteにも書くべきではないな。
      delete _actor.info['from'];
      delete _actor.info['to'];
      delete _actor.info['diffVector'];
    }
  }
  setting(dict){
    // パラメータの再設定(これでflowの再利用をする)
    this.easeId_parallel = dict['easeId_parallel'];
    this.easeId_normal = dict['easeId_normal'];
    this.ratio = dict['ratio'];
    this.spanTime = dict['spanTime'];
    this.kind = dict['kind'];
    this.infoVectorArray = dict['infoVectorArray'];
    this.currentIndex = 0; // リセット
    this.revolveMode = dict['revolveMode'];
  }
}

flow.index = 0; // convertに使うflowの連番

// 純粋なactorはflowをこなすだけ、言われたことをやるだけの存在
class actor{
  constructor(f = undefined){
    // colorIdはそのうち廃止してビジュアルをセッティングするなんかつくる
    this.index = actor.index++;
    this.currentFlow = f; // 名称をcurrentFlowに変更
    this.timer = new counter();
    this.isActive = false; // デフォルトをfalseにしてプログラムのインプット時にtrueにする作戦で行く
    this.state = IDLE; // 状態（IDLE, IN_PROGRESS, COMPLETED）
		this.info = {}; // 各種情報
  }
  activate(){ this.isActive = true; } // isActiveがfalse⇔updateしない。シンプル。これを目指している。
  inActivate(){ this.isActive = false; } // 冗長だけどコードの可読性の為に両方用意する。
  setState(newState){ this.state = newState; } // stateをチェンジ
  setFlow(newFlow){ this.currentFlow = newFlow; } // flowをセットする
  // 再スタートさせるなら、まずflowをセット、次いでactivateという流れになります。
  // flowだけセットしてactivateしなければ待機状態を実現できます。いわゆるポーズ、
  // entityの側でまとめてactivate, inActivateすればまとめて動きを止めることも・・・・
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
  kill(){
    // 自分を排除する
    let selfId;
    for(selfId = 0; selfId < all.actors.length; selfId++){
      if(all.actors[selfId].index === this.index){ break; }
    }
    all.actors.splice(selfId, 1);
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
// むぅぅ。posControllerも作りたい。足し算で挙動に変化を加えるとか。

// flowのcontrollerですね
// 特定のflowを登録すると、dictの配列をcompleteの度にローテーションで放り込む。
// flowはsettingという関数を持っていて、辞書を受け取ることができる必要があります。
// 基本的にcontroller系はすべて対象が何かしらの関数を持っている必要があるんです。setPosとか。
// いいや、汎用コントローラーとして定式化しよう。
// dict引数のsetting持ちなら何でもOK! Yeah!!（いけるのかな・・）
class multiController extends actor{
  constructor(f = undefined, targetObject){
    super(f);
    this.targetObject = targetObject;
    this.currentIndex = 0;
    this.patternArray = [];
  }
  registPattern(nameSet, paramSet){
    // nameSetに入ってるパラメータ名の所にparamSetの内容を登録
    let newDict = {};
    for(let i = 0; i < nameSet.length; i++){
      newDict[nameSet[i]] = paramSet[i];
    }
    this.patternArray.push(newDict);
  }
  completeAction(){
    console.log("%d for multiController", frameCount);
    this.targetObject.setting(this.patternArray[this.currentIndex]); // completeの度にsetting.
    this.currentIndex = (this.currentIndex + 1) % this.patternArray.length; // 回す
    this.setState(IDLE);
    this.currentFlow.convert(this);
  }
}
// もっとも順繰りに回すことがすべてではないですけどね・・この手の何て言うんだろうな、
// パフォーマンス系のプログラムにはもってこいのactorでしょう。
// 走らせるルートをいじればインターバル変更も自由自在ですし。
// Gimicはflowじゃないんだっけ忘れてた。。。いいや別に作ろう（おい）
// というわけでmultiControllerになりました（ええ・・）

// たとえば背景をクラス扱いしてそれを形成する色の部分に変化を加えて・・とかできる。

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

// flowの開始時、終了時に何かさせたいときの処理
// initialはflowのinitializeの直前、completeはflowの完了直後に発動する
class Gimic{
  constructor(myFlowId){
    this.myFlowId = myFlowId; // idにしないと識別できないのよ・・
  }
  action(_actor){ return; };
  initialCheck(_actor, flowId){
    if(_actor.state === IDLE && _actor.isActive && flowId === this.myFlowId){ return true; }
    return false;
  }
  completeCheck(_actor, flowId){
    if(_actor.state === COMPLETED && _actor.isActive && flowId === this.myFlowId){ return true; }
    return false;
  }
}

class colorChangeGimic extends Gimic{
  // 色を変化させるギミック
  constructor(myFlowId, x, y, z, w){
    super(myFlowId);
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  action(_actor){
    _actor.visual.changeColor(this.x, this.y, this.z, this.w);
  }
}

class figureChangeGimic extends Gimic{
  // 形を変化させるギミック
  constructor(myFlowId, newFigureId){
    super(myFlowId);
    this.newFigureId = newFigureId;
    //console.log('construct');
  }
  action(_actor){
    //console.log("発動");
    _actor.visual.changeFigure(this.newFigureId);
  }
  setting(dict){
    console.log(dict);
    this.newFigureId = dict['newFigureId']; // 力技感すごいけどまあ汎用的ではあるな。
  }
}

// flowに装飾をするのが仕事。
// flowの性質そのものをいじるのが目的ではない。
// myFlowIdはあくまで発動させるflowの場所を指定するだけで、
// これをもとにflowにアクセスして内容をいじるのが目的ではない。
// たとえばボードゲームとかで状態異常発生させるとかワープさせる、そういうことに使うんです、これは。
// 汎用コードだとあんま使い道ないかもね・・

// flowのupdateとかやりたいわね
// 使い終わったactorの再利用とかしても面白そう（他のプログラムでやってね）（trash）
class entity{
  constructor(){
    this.base = createGraphics(width, height);
    this.flows = [];
    this.baseFlows = []; // baseのflowの配列
    this.updateList = []; // updateが必要なflowのリスト
    this.actors = [];
    this.initialGimic = [];  // flow開始時のギミック
    this.completeGimic = []; // flow終了時のギミック
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
    createMassGameNew(); // MassGameをCreateする
    this.baseFlows.forEach(function(f){ f.display(this.base); }, this); // ベースグラフの初期化（addは毎ターン）
  }
  reset(){
    this.base.clear();
    this.flows = [];
    this.baseFlows = []; // baseのflowの配列
    this.updateList = []; // updateListのクリア
    this.actors = [];
    flow.index = 0; // 通し番号リセット
    actor.index = 0;
    this.initialGimic = [];
    this.completeGimic = [];
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
  registFlow(paramSet, flag = true){
    // paramSetはパラメータの辞書(params)の配列。
    paramSet.forEach(function(params){
      let newFlow = entity.createFlow(params);
      this.flows.push(newFlow);
      if(flag){
        this.baseFlows.push(newFlow); //flagをoffにするとbaseFlowに入らないので描画されない。
      }
    }, this);
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
  static createFlow(params){
    if(params['type'] === 'straight'){
      return new straightFlow(params['from'], params['to'], params['factor']);
    }else if(params['type'] === 'jump'){
      return new jumpFlow(params['from'], params['to']);
    }else if(params['type'] === 'assemble'){
      return new assembleHub(params['limit']);
    }else if(params['type'] === 'fall'){
      return new fallFlow(params['speed'], params['distance'], params['height']);
    }else if(params['type'] === 'shooting'){
      return new shootingFlow(params['v'], params['id1'], params['id2']); // fromは廃止
    }else if(params['type'] === 'wait'){
      return new waitFlow(params['span']); // spanフレーム数だけアイドリング。combatに使うなど用途色々
    }else if(params['type'] === 'colorSort'){
      return new colorSortHub(params['targetColor']); // targetColorだけ設定
    }else if(params['type'] === 'orbitalEasing'){
      return new orbitalEasingFlow(params['easeId1'], params['easeId2'], params['ratio'], params['spanTime'], params['from'], params['to']);
    }else if(params['type'] === 'orientedMuzzle'){
      return new orientedMuzzle(params['easeId1'], params['easeId2'], params['ratio'], params['spanTime'], params['kind'], params['infoVectorArray'], params['mode']);
    }else if(params['type'] === 'vector'){
      return new vectorFlow(params['easeId1'], params['easeId2'], params['ratio'], params['spanTime'], params['directionVector']);
    }else if(params['type'] === 'constant'){
      return new constantFlow(params['from'], params['to'], params['spanTime']);
    }
  }
  initialGimicAction(){
    if(this.initialGimic.length === 0){ return; }
    this.initialGimic.forEach(function(g){
      this.actors.forEach(function(a){
        if(a.currentFlow === undefined){ return; }
        if(g.initialCheck(a, a.currentFlow.index)){ g.action(a); }
      })
    }, this)
  }
  completeGimicAction(){
    if(this.completeGimic.length === 0){ return; }
    this.completeGimic.forEach(function(g){
      this.actors.forEach(function(a){ // forEachの場合のcontinueは「return」だそうです（関数処理だから）
        if(a.currentFlow === undefined){ return; }
        if(g.completeCheck(a, a.currentFlow.index)){ g.action(a); }
      })
    }, this)
  }
  update(){
    this.actors.forEach(function(_actor){
      _actor.update(); // flowもupdateしたいんだけどね
    })
    this.updateList.forEach(function(_flow){ _flow.update(); })  // updateListが[]でなければ実行
  }
  draw(){
    image(this.base, 0, 0);
    this.actors.forEach(function(_actor){ // actorの描画
      _actor.display();
    })
  }
}

// --------------------------------------------------------------------------------------- //

function createMassGameNew(){
  // もういちどMassGame.
  // 基本は整流 → orientedMuzzle → assemble → wait. これの繰り返し。
  // 最初にぎゅっを作る。
  let rectify = new rectifierHub(2); // 2フレームに1個排出
  let mainMuzzle = new orientedMuzzle(6, 0, 0.1, 60, DIRECT, [createVector(300, 300)], 0); // 最初のぎゅっ
  let assemble = new assembleHub(36); // 36匹集まると解放
  let waitMotion = new waitFlow(31); // ちょっと待つ
  // このシークエンスを延々と繰り返す
  all.flows = all.flows.concat([rectify, mainMuzzle, assemble, waitMotion]); // テスト
  all.connectMulti([0, 1, 2, 3], [[1], [2], [3], [0]]); // つなげる
  all.updateList.push(rectify); // rectifyはupdateします。

  // 形を変えるギミックを用意
  let figureChanger = new figureChangeGimic(0, 0); // rectifierに仕掛ける
  all.initialGimic.push(figureChanger);

  // メインアクター。
  all.registActor(constSeq(0, 36), constSeq(1, 36), constSeq(0, 36));

  // レールを用意する
  //let fcRail = new straightFlow(createVector(0, 0), createVector(0, 166), 1);
  let fcRail = new waitFlow(166);
  let fcRail_2 = new waitFlow(166);
  // これでframeCountはwaitが終わったところで164になるそうです。ぴったり！やったね。これで行こう。
  all.flows.push(fcRail);
  all.flows.push(fcRail_2);
  all.connectMulti([4, 5], [[5], [4]]); // 無限ループ
  // コントローラーを用意する
  let rc = new multiController(fcRail, rectify); // 整流器用
  rc.registPattern(['interval'], [2]);
  rc.registPattern(['interval'], [0]);
  let wc = new multiController(fcRail, waitMotion); // 待ち時間用
  wc.registPattern(['span'], [31]); // delayありの方は31が正解。
  wc.registPattern(['span'], [100]); // delayなしの方は100が正解。
  let pc = new multiController(fcRail, mainMuzzle); // マズル用
  let vecs = getPatternVector(0);
  pc.registPattern(['easeId_parallel', 'easeId_normal', 'ratio', 'spanTime', 'kind',  'infoVectorArray', 'revolveMode'], [6, 0, 0.1, 60, DIRECT, vecs, 0])
  pc.registPattern(['easeId_parallel', 'easeId_normal', 'ratio', 'spanTime', 'kind',  'infoVectorArray', 'revolveMode'], [6, 0, 0.1, 60, DIRECT, [createVector(100, 200), createVector(500, 400)], 1])
  let fc = new multiController(fcRail, figureChanger); // 形状変化
  fc.registPattern(['newFigureId'], [1]);
  fc.registPattern(['newFigureId'], [2]);
  all.actors = all.actors.concat([rc, wc, pc, fc]);
  // 順序としてはその、rectifierいじるのの直前にcontrollerが発動する必要があって結構シビアな事になってる・・
  // ともあれ、これでいけるでしょう。
  // actorの誰かがrectifierに到達する前にrectifierのcontrollerが発動する必要があって、
  // それを調べていました。これで大丈夫そうです。
  // ワンサイクルが1多いのはハブでの切り替えで1フレーム使っているから。

  // カラーレールとカラーコントローラー（メインアクター用、背景用）は一番最後でいいです

  all.activateAll();
  let firstPos = getVector(arSinSeq(0, 2 * PI / 36, 36, 100, 300), arCosSeq(0, 2 * PI / 36, 36, 100, 300));
  for(let i = 0; i < 36; i++){ all.actors[i].setPos(firstPos[i].x, firstPos[i].y); }
}

// まあ、bulletってクラス作ってfromとtoとdiffVector持たせればいいんだけどね・・
function createMassGame(){
  // MassGame本体。
  // 最初に中心に固める。半径は120にする。スピードを1にする。
  let vecs = rotationSeq(200, 0, 2 * PI / 36, 36, 300, 300); // 回転sequence.
  vecs.push(createVector(300, 300)); // 中心
  let paramSet = getOrbitalEasingFlow(vecs, constSeq(6, 36), constSeq(0, 36), constSeq(0, 36), constSeq(120, 36), arSeq(0, 1, 36), constSeq(36, 36)); // 中心にぎゅーっ
  all.registFlow(paramSet);
  // ここがスタートで、最後はこれの次のflowにつなげる。
  // まずrect. 中央の300×300に集めてね。(36)
  let randomFlow = new orientedMuzzle(0, 0, 0.1, 120, DIRECT, [createVector(150, 150), createVector(450, 450)], 1);
  all.flows.push(randomFlow);
  all.connectMulti(arSeq(0, 1, 36), constSeq([36], 36)); // つなげる
  // 次に、正方形。順番を工夫して螺旋を描くようにする。(37)
  vecs = getPatternVector(0); // 正方形
  // 登録
  let patternFlow = new orientedMuzzle(10, 0, 0.1, 120, DIRECT, vecs, 0); // simple.
  all.flows.push(patternFlow);
  // 次に、中心(300, 300)で半径150の円に集めてね。(38)
  randomFlow = new orientedMuzzle(0, 0, 0.1, 120, DIRECT, [createVector(300, 300), createVector(150, 150)], 2);
  all.flows.push(randomFlow);
  // 次に星型。(39)
  vecs = getPatternVector(1); // 星型
  patternFlow = new orientedMuzzle(10, 0, 0.1, 120, DIRECT, vecs, 0); // simple.
  all.flows.push(patternFlow);
  // 次に十字型(インターバル)。(40)
  vecs = getPatternVector(2);
  patternFlow = new orientedMuzzle(10, 0, 0.1, 120, DIRECT, vecs, 0);
  all.flows.push(patternFlow);
  // 次に三角形。(41)
  vecs = getPatternVector(3);
  patternFlow = new orientedMuzzle(10, 0, 0.1, 120, DIRECT, vecs, 0);
  all.flows.push(patternFlow);
  // 横長rectランダム。(42)
  randomFlow = new orientedMuzzle(0, 0, 0.1, 120, DIRECT, [createVector(100, 200), createVector(500, 400)], 1);
  all.flows.push(randomFlow);
  // ひし形4つ。(43)
  vecs = getPatternVector(4);
  patternFlow = new orientedMuzzle(10, 0, 0.1, 120, DIRECT, vecs, 0);
  all.flows.push(patternFlow);
  // 縦長ランダム(44)
  randomFlow = new orientedMuzzle(0, 0, 0.1, 120, DIRECT, [createVector(200, 100), createVector(400, 500)], 1);
  all.flows.push(randomFlow);
  // 六角形(45)
  vecs = getPatternVector(5);
  patternFlow = new orientedMuzzle(10, 0, 0.1, 120, DIRECT, vecs, 0);
  all.flows.push(patternFlow);
  // たて直線(46)
  patternFlow = new orientedMuzzle(10, 0, 0.1, 120, DIRECT, getVector(constSeq(300, 36), arSeq(125, 10, 36)), 0);
  all.flows.push(patternFlow);
  // らせん(47)
  vecs = getPatternVector(6);
  patternFlow = new orientedMuzzle(10, 0, 0.1, 120, DIRECT, vecs, 0);
  all.flows.push(patternFlow);
  // よこ直線(48)
  patternFlow = new orientedMuzzle(10, 0, 0.1, 120, DIRECT, getVector(arSeq(125, 10, 36), constSeq(300, 36)), 0);
  all.flows.push(patternFlow);
  // 円周(49)
  vecs = getPatternVector(7);
  patternFlow = new orientedMuzzle(10, 0, 0.1, 120, DIRECT, vecs, 0);
  all.flows.push(patternFlow);
  // 最後にギュっ(50)
  patternFlow = new orientedMuzzle(0, 0, 0.1, 120, DIRECT, [createVector(300, 300)], 0);
  all.flows.push(patternFlow);
  all.connectMulti([36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50], [[37], [38], [39], [40], [41], [42], [43], [44], [45], [46], [47], [48], [49], [50], [36]]); // 最初に戻る

  // 形を変えるギミックを配置
  let gimicIdArray = [37, 39, 41, 43, 45, 47, 49, 50]; // あー、そうか、あれ動いてる途中だっけ、イニシャルにしよ。
  for(let i = 0; i < 8; i++){
    let g = new figureChangeGimic(gimicIdArray[i], i);
    all.initialGimic.push(g);
  } // ギミック面目躍如（よかったね）
  // カラーコントローラー仕込むね
  // wait(120)からはじまってギザギザ14回、そのあと頭のwait(120)につなぐ。
  // まずメインアクター用のカラーレール
  all.flows.push(new waitFlow(120)); // (51)
  let posX = [0, 5, 10, 13, 17, 26, 35, 43, 52, 58, 64, 72, 80, 90, 100];
  let posY = [100, 80, 100, 80, 100, 80, 100, 80, 100, 80, 100, 80, 100, 80, 100];
  vecs = getVector(posX, posY);
  patternFlow = getOrbitalEasingFlow(vecs, constSeq(0, 14), constSeq(0, 14), constSeq(0, 14), constSeq(120, 14), arSeq(0, 1, 14), arSeq(1, 1, 14));
  all.registFlow(patternFlow, false); // レールは非表示
  // 14本なので52～65. 65のあとまた51に戻る。
  all.connectMulti(arSeq(51, 1, 15), [[52], [53], [54], [55], [56], [57], [58], [59], [60], [61], [62], [63], [64], [65], [51]]);
  // 次に、背景色用のカラーレール
  all.flows.push(new waitFlow(120)); // (66)
  posX = [0, 5, 10, 13, 17, 26, 35, 43, 52, 58, 64, 72, 80, 90, 100];
  posY = [30, 0, 30, 0, 30, 0, 30, 0, 30, 0, 30, 0, 30, 0, 30];
  vecs = getVector(posX, posY);
  patternFlow = getOrbitalEasingFlow(vecs, constSeq(0, 14), constSeq(0, 14), constSeq(0, 14), constSeq(120, 14), arSeq(0, 1, 14), arSeq(1, 1, 14));
  all.registFlow(patternFlow, false);
  // 14本なので67～80. 80のあとまた66に戻る。
  all.connectMulti(arSeq(66, 1, 15), [[67], [68], [69], [70], [71], [72], [73], [74], [75], [76], [77], [78], [79], [80], [66]]);
  // 先にアクターを生成する(なんていうか当たり前だけど、ほんとにactor(演技者)だねこれ・・感動。)
  all.registActor(arSeq(0, 1, 36), constSeq(1, 36), constSeq(0, 36));
  //for(let i = 0; i < 36; i++){ //console.log(all.actors[i].index); }
  // 次にカラーコントローラー用意して完成
  let cc = new colorController(all.flows[51], 0, 100, 1);
  all.actors.push(cc);
  for(let i = 0; i < 36; i++){ cc.addTarget(all.actors[i].visual); }
  let bcc = new backgroundColorController(all.flows[66], 0, 30, 1);
  all.actors.push(bcc);
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

function getOrbitalEasingFlow(vecs, idSet1, idSet2, ratioSet, spanSet, firstVectorIds, secondVectorIds){
  // orbitalEasingFlow用(spanに-1入れるのはやめた・・)
  let paramSet = [];
  for(let i = 0; i < idSet1.length; i++){
    let dict = {type:'orbitalEasing', easeId1:idSet1[i], easeId2:idSet2[i], ratio:ratioSet[i], spanTime:spanSet[i]};
    dict['from'] = vecs[firstVectorIds[i]];
    dict['to'] = vecs[secondVectorIds[i]];
    paramSet.push(dict);
  }
  return paramSet;
}

function getOrientedMuzzle(vecs, idSet1, idSet2, ratioSet, spanSet, kinds, arrayOfInfoIdArray, modes){
  // orientedFlow用(muzzle用)
  let paramSet = [];
  for(let i = 0; i < idSet1.length; i++){
    let dict = {type:'orientedMuzzle', easeId1:idSet1[i], easeId2:idSet2[i], ratio:ratioSet[i], spanTime:spanSet[i], kind:kinds[i], mode:modes[i]};
    // ベクトルの集合に置き換える
    let infoVectorArray = [];
    arrayOfInfoIdArray[i].forEach(function(id){ infoVectorArray.push(vecs[id]); })
    dict['infoVectorArray'] = infoVectorArray;
    paramSet.push(dict);
  }
  return paramSet;
}

// イージングに引数取るようにしたら面白そう
function funcP0(x){ return x; } // 通常。
function funcP1(x){ return 3 * pow(x, 2) - 2 * pow(x, 3); } // 2乗で入って3乗で出る
function funcP2(x){ return 3 * pow(x, 4) - 2 * pow(x, 6); } // 4乗で入って6乗で出る
function funcP3(x){ return x * (2 * x - 1); } // バックイン
function funcP4(x){ return 1 + (1 - x) * (2 * x - 1); } // バックアウト
function funcP5(x){ return -12 * pow(x, 3) + 18 * pow(x, 2) - 5 * x; } // バックインアウト
function funcP6(x){ return (x / 8) + (7 / 8) * pow(x, 4); } // ゆっくり からの ぎゅーーーん
function funcP7(x){ return (7 / 8) + (x / 8) - (7 / 8) * pow(1 - x, 4); } // ぎゅーーーん からの ゆっくり
function funcP8(x){ return 0.5 * (1 - cos(9 * PI * x)); } // 波打つやつ
// 0.5までゆっくりぎゅーんのあと停止
function funcP9(x){ return min(192 * pow(x, 5) - 240 * pow(x, 4) + 80 * pow(x, 3), 1); }
// はじめの0.5までで一気に進んでそのあと0.5休む（idで平行移動してディレイに使う）
function funcP10(x){ return pow(max(0, min(2 * x, 1)), 3); }

function funcN0(x){ return 0; }
