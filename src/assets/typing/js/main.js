/*global define */
const KEY_CODE = {
    "esc"   : 27,
    "space" : 0x20,
    "shift" : 16,
    "alt"   : 18,
    "tab"   : 9,
    "f5"    : 116
};
const STORAGE_KEY_NAME = "type_result";

let appConfig = {
    timeLimit: 30,
    bugSpeed: 1500
}

//Jqueryオブジェクト群
let $elm = {
    gameTimer         : {},
    bug               : {},
    storedDataDisplay : {},
    notice            : {},
    odai: {
        display    : {},
        ttl        : {},
        text       : {},
        text_typed : {}
    },
    settings: {
        isSoundOn : {},
        isRandom  : {}
    },
    odaiList: {
        list       : {},
        toggleLink : {},
        closeLink  : {},
        select     : {}
    },
    odaiInfo: {
        selectedOdai: {}
    }
}

//各種データ
let store = {
    timeRemaining: appConfig.timeLimit, //残り時間
    odai: {
        list           : [],
        lineNum        : 0,  //お題の行数
        targetText     : "",
        targetTextList : [],
        currentOdaiNum : -1,  //現在のお題番号
    },
    gameResult: {
        name      : "",
        typingNum : 0,
        stepNum   : 0,
        typo      : 0
    },
    flags: {
        isGameStart: false,
        isGameReady: true
    },
    settings: {
        isSoundOn : false,
        isRandom  : false
    }
}

const helper = {
    getSavedData: () => {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_NAME));
    },
    saveData: (argData) => {
        localStorage.setItem(STORAGE_KEY_NAME, JSON.stringify(argData));
        return false;
    },
    getPast: (function () {
        //経過時間取得
        //FROM http://qiita.com/ginpei/items/5b384d5fb54997bc158c
        let lastDate = NaN;
        return function () {
            let now = Date.now();
            let past = now - lastDate;
            lastDate = now;
            return past;
        };
    })(),
    getUrlParam: function (name) {
        let results = new RegExp("[\?&]" + name + "=([^&#]*)").exec(window.location.href);
        return (results) ? results[1] : 0;
    }
}

let actions = {

    /** スコア表示などを初期化 */
    initGameDisplay: function () {
        store.flags.isGameStart = false;
        store.flags.isGameReady = false;

        store.timeRemaining = appConfig.timeLimit;

        store.gameResult.typingNum = 0;
        store.gameResult.stepNum   = 0;
        store.gameResult.typo      = 0;
    },

    /** ゲーム終了時の処理 */
    gameIsOver: function () {

        let resultText    = "",
            savedTypingNum = "",
            savedData      = helper.getSavedData();

        if (savedData) {
            savedData.forEach(function (val) {
                if (val.name === store.gameResult.name) {
                    savedTypingNum = val.data.typingNum;
                }
            });
        }

        //タイピング結果を設定
        if (savedData && savedTypingNum) {
            resultText = "ハッカー率 : " + Math.round(store.gameResult.typingNum / savedTypingNum * 100) + '%';
        } else {
            resultText = "ハッカー率 : - %";
        }
        $elm.odai.ttl.text("End!!!" + resultText);


        $elm.odai.display.empty().append("<span class='odai-text'>終了！！！！！ again ?? press ESC</span>");

        $elm.notice.empty()
            .append("<h3>結果 : ")
            .append("<span style='color:red; font-seize:2em'>[正解タイプ数 : " + store.gameResult.typingNum + "]</span>")
            .append("[合計ステップ数 : " + store.gameResult.stepNum + "]")
            .append("[タイポ数 : " + store.gameResult.typo + "]" + "</h3><hr />");

        actions.memoryResultToSes();
        actions.restoreSavedResult();
        actions.initGameDisplay();

        //TODO 練習用
        alert('attention please');
        window.location.reload();
    },

    /** お題の設定ファイルを設定 */
    initOdaiFile: function (argOdaiFile) {
        let odaiFile = "data/" + argOdaiFile;

        $.get(odaiFile)
            .done(function (data) {
                store.odai.list = data;
            })
            .fail(function () {
                store.odai.list = [
                    {
                        "ja": "お題の取得に失敗しました",
                        "en": "odainoshutokunisippaisimasita"
                    }
                ];
            })
            .always(function () {
                actions.changeOdaiDisp();
            });
    },

    /** タイピングの結果をセッションに保存する。*/
    memoryResultToSes: function () {

        let newResult = [];
        let savedSes  = helper.getSavedData();

        if (savedSes) {
            savedSes.forEach(function (ses) {
                if (ses.name === store.gameResult.name) {
                    if (store.gameResult.typingNum > ses.data.typingNum) {
                        alert("新記録！！！");
                        ses.data = store.gameResult;
                    }
                }
                newResult.push(ses);
            });
        }

        if (newResult.length === 0) {
            newResult = [{
                "name": store.gameResult.name,
                "data": store.gameResult
            }];
        }

        helper.saveData(newResult);

    },

    /** TODO バインドしたい。最高記録をセッションから復元 */
    restoreSavedResult: function () {

        let newText = "最高記録 : なし"
            + "[正解 : -]"
            + "[合計ステップ数 : -]"
            + "[タイポ : -]";

        let savedData = helper.getSavedData();
        if (savedData) {
            savedData.forEach(function (data) {
                if (data.name === store.gameResult.name) {
                    let newData = data.data;

                    newText = newData.name + "の最高記録 : "
                        + "[正解 : " + newData.typingNum + "]"
                        + "[合計ステップ数 : " + newData.stepNum + "]"
                        + "[タイポ : " + newData.typo + "]";
                }
            });
        }

        $elm.storedDataDisplay.empty().append(newText);
    },

    /** お題の表示を変更する。*/
    changeOdaiDisp: function () {

        //debugger;
        if (store.odai.targetTextList.length > 1) {
            //お題が複数行ある場合
            store.odai.lineNum += 1;
            store.odai.targetTextList.shift();

        } else {
            //一行または、複数行お題の1行目か、最後の行の場合

            if (store.settings.isRandom === true && store.odai.list.length !== 1) {
                //お題が一個以上の場合

                //ランダムお題の設定で、前回と同じお題の場合は再帰処理でもう一度
                let randNum = Math.floor(Math.random() * store.odai.list.length);

                if (randNum === store.odai.currentOdaiNum) {
                    actions.changeOdaiDisp();
                    return;
                }

                store.odai.currentOdaiNum = randNum;

            } else {

                if (store.odai.currentOdaiNum === -1) {
                    store.odai.currentOdaiNum = 0; //TODO 確認

                } else if ((store.odai.list.length - 1) === store.odai.currentOdaiNum) {
                    //お題配列最後まで行ったら、一周して最初から。
                    store.odai.currentOdaiNum = 0; //TODO 0始まり

                } else {
                    store.odai.currentOdaiNum++;
                }
                store.odai.lineNum = 0;//初期化

            }

            //お題のテキスト群を設定
            $elm.odai.display.empty();
            let num = store.odai.currentOdaiNum;
            $elm.odai.ttl.text(store.odai.list[num].ja);
            store.odai.targetText = store.odai.list[num].en;

            //お題テキストリスト用の空 DOM を生成
            //\nは改行コードとし、複数行お題として扱う。
            store.odai.targetTextList = store.odai.targetText.split(/\n/g);

            store.odai.targetTextList.forEach(function () {
                $elm.odai.display.append("<li>" +
                    "<span class='odai-text-typed'></span>" +
                    //"<span class='odai-text' style='display: none;'></span>" +
                    "<span class='odai-text'></span>" + //TODO タイピングエリアの文字を表示・非表示を制御する
                    "</li>");
            });

            //お題のテキストを差し込み
            let list = $elm.odai.display.find(".odai-text");
            $.each(list, function (i, v) {
                $(v).text(store.odai.targetTextList[i]);
            });
        }

        //TODO バグ虫の移動 (強制的に左へ。) いい加減バグに関してなんとかしたい。
        //$elm.odai.bug.css("left", -180 + "px");

        //テキスト変更対称用の $オブジェクトを設定
        let elmCurrentOdaiLine = $elm.odai.display.find(".odai-text")[store.odai.lineNum];
        $elm.odai.text = $(elmCurrentOdaiLine);

        let elmCurrentOdaiLine_typed = $elm.odai.display.find(".odai-text-typed")[store.odai.lineNum];
        $elm.odai.text_typed = $(elmCurrentOdaiLine_typed);

    },

    setupuOdaiSelect: function () {
        let list = [
            {"name": "JavaScript", "file": "test_js.json", "extra": {}},
            {"name": "Backbone.js", "file": "test_backbone.json"},
            {"name": "React - Redux", "file": "test_react-redux.json"},
            {"name": "Vue.js", "file": "test_vuejs.json"},
            {"name": "Node.js", "file": "test_nodejs.json"},
            {"name": "正規表現", "file": "test_reg.json"},
            {"name": "PHP Lalavel", "file": "test_php_laravel.json"},
            {"name": "Cake　PHP", "file": "test_php_cakephp.json"},
            {"name": "SQL", "file": "test_sql.json"},
            {"name": "Angular JS", "file": "test_angular.json"},
            {"name": "Angular 2", "file": "test_angular2.json"},
            {"name": "Git", "file": "test_git.json"},
            {"name": "Linuxコマンド", "file": "test_linux.json"},
            {"name": "Docker", "file": "test_docker.json"},
            {"name": "一般知識", "file": "test_iroiro.json"},
            {"name": "ディープラーニング", "file": "test_deep.json"},
            {"name": "長文です", "file": "test_long.json"},
            {"name": "英語", "file": "test_english.json"},
            {"name": "歌", "file": "test_song.json"},
            {"name": "寿司", "file": "test_sushi.json"},
            {"name": "お笑い", "file": "test_warai.json"},
        ];
        let $odaiList = $("#js-odaiList").find("select");
        $.each(list, function (i, v) {
            $odaiList.append("<option value='" + v.file + "'>" + v.name + "</option>");
        });
        //actions.restoreSavedResult();

    }
}

let handleKeyDown = function (e) {

    let keyName = e.key;
    let keyCode = e.keyCode;

    //ESCキーの押下でゲームの開始準備
    if (keyCode === KEY_CODE.esc && !store.flags.isGameReady) {
        //TODO コンティニューでお題のひきまシガできないバグの発端。
        $elm.odai.text.text("READY？？？？？ press space");
        store.flags.isGameReady = true;
    }

    //スペースキーの押下でゲーム開始
    //debugger;
    if (e.keyCode === KEY_CODE.space && !store.flags.isGameStart && store.flags.isGameReady) {

        //お題ファイルの選択状態を確認
        let targetOdaiFile = $("#odaiSelect").val();
        if (targetOdaiFile === "") {
            console.log("お題を選択してください。");
            return;
        }
        store.flags.isGameStart = true;

        store.gameResult.typo = 0;//TODO 最初はタイポをカウントしたくないので暫定

        actions.initOdaiFile(targetOdaiFile);

        //DOM操作
        //$(".typingArea").show();
        $elm.gameTimer.text(appConfig.timeLimit);

        //残り時間タイマー減算
        let typeTimer = setInterval(function () {
            store.timeRemaining--;
            $elm.gameTimer.text(store.timeRemaining);

            //タイマーの時間が来たら終了
            if (store.timeRemaining === 0) {
                clearInterval(typeTimer);
                clearInterval(bugMoveTimer);
                actions.gameIsOver();

                //todo 失敗したお題から再開させたいのでお題番号を戻す
                store.odai.currentOdaiNum -= 1;
                store.odai.targetTextList = [];

                store.flags.isGameReady = false;
            }

        }, 1000);

        //バグ移動 200pxになるまで左に移動する
        let bugMoveTimer = setInterval(function () {
            //console.log(timerArray);

            let bugPos = $elm.bug.css("left");
            //bugPos　が undefined になる場合がある。(バグを非表示にした場合)
            if (bugPos) {
                let newPos = Number(bugPos.replace("px", ""));
                if (newPos > 900) {
                    if (store.odai.list.length === 0) {
                        console.log("おーわり。");//終わりのタイミングを何とかしたいけどね。
                        clearInterval(bugMoveTimer);
                    } else {
                        actions.changeOdaiDisp();
                    }
                } else {
                    $elm.bug.css("left", (newPos + 25) + "px");
                }
            }

        }, appConfig.bugSpeed);//TODO 500くらいが良いよ

        if (store.settings.isSoundOn) {
            helper.getPast();
        }


    }

    if (!store.flags.isGameStart || Object.keys($elm.odai.text).length === 0 || !$elm.odai.text) {
        //TODO 空の場合
        return;
    }

    //正解の場合 : キーボード入力によって文字を消していく。
    if ($elm.odai.text.text().indexOf(keyName) === 0) {

        // if (!store.flags.isGameStart) {
        //     return;
        // }

        //正解したテキストの数を保持
        store.gameResult.typingNum++;

        //正解した文字を正解表示エリアにテキスト設定
        let finishedOdai = $elm.odai.text.text().substr(0, 1);
        $elm.odai.text_typed.append(finishedOdai);

        //先頭の一文字を削除したテキストをお題として再設定
        let newOdai = $elm.odai.text.text().substr(1);
        $elm.odai.text.text(newOdai);

        //お題がすべて正解した場合、次のお題へ
        console.log($elm.odai.text.text().length);
        if ($elm.odai.text.text().length === 0) {
            store.gameResult.stepNum++;
            actions.changeOdaiDisp();
        }

        //TODO getPast : キーの押しっぱなしで音が止まらないバグ対策
        let time = helper.getPast();
        if (store.settings.isSoundOn && time > 50) {
            soundObj.playSound();
        }

    } else {
        //タイピングが間違えていた場合

        if ($elm.odai.text.text().indexOf(" ") === 0) {
            console.log("TODO 空白スペースを押してな。");
        }

        if (keyCode === KEY_CODE.shift || keyCode === KEY_CODE.alt || keyCode === KEY_CODE.tab || keyCode === KEY_CODE.f5) {
            //Shift || Alt ||  Tab が押された場合は何もしない。
            console.log("");
        } else {
            store.gameResult.typo++;

            if (store.settings.isSoundOn && helper.getPast() > 50) {
                let isTypo = true;
                soundObj.playSound(isTypo);
            }

            //TODO 練習用ミスを減らすように renshuu
            //store.timeRemaining = 1;
            //alert(keyName + " pressed...")
          //window.location.reload();

        }
    }
}

$(document).ready(function () {

    actions.setupuOdaiSelect();

    //jQuery ===================== オブジェクトセットアップ
    $elm.gameTimer         = $("#gameTimer");
    $elm.bug               = $(".bug");
    $elm.storedDataDisplay = $("#storedDataDisplay");
    $elm.notice            = $("#notice");
    $elm.odai.display      = $("#odai-display");
    $elm.odai.ttl          = $(".odai-ttl");
    //設定
    $elm.settings.isSoundOn = $("#isSoundOn");
    $elm.settings.isRandom  = $("#isOdaiRandom");
    //リスト
    $elm.odaiList.list       = $(".app-list");
    $elm.odaiList.toggleLink = $("#js-odaiList-menu");
    $elm.odaiList.closeLink  = $("#js-odaiList-menu .app-list-close");
    $elm.odaiList.select     = $("#odaiSelect");
    //情報
    $elm.odaiList.selectedOdai = $("#js-app-main-info-odai");


    //イベント =====================
    $elm.settings.isSoundOn.bind("change", function () {
        store.settings.isSoundOn = $elm.settings.isSoundOn.prop("checked");
    });
    $elm.settings.isRandom.bind("change", function () {
        store.settings.isRandom = $elm.settings.isRandom.prop("checked");
    });
    $elm.odaiList.toggleLink.click(function () {
        $elm.odaiList.list.toggle(300);
    });
    $elm.odaiList.closeLink.click(function () {
        $elm.odaiList.list.toggle(300);
    });
    $elm.odaiList.select.change(function () { //TODO
        $elm.odaiList.selectedOdai.text("お題 : " + $("#odaiSelect").val());//TODO お題名
        store.gameResult.name = odaiParam;
        actions.restoreSavedResult();
        $elm.odaiList.list.toggle(300);
    });


    //前のページからのお題の設定
    let odaiParam = helper.getUrlParam("p");
    $elm.odaiList.select.val(odaiParam);
    $elm.odaiList.selectedOdai.text("お題 : " + odaiParam);//TODO お題名
    store.gameResult.name = odaiParam;//選択されたお題名

    actions.restoreSavedResult();

    document.addEventListener("keydown", handleKeyDown);
});


/**
 * 音楽関連
 */
class TypingSound {

    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.notesByKeyCode = {
            0: {noteName: "c4", frequency: 261.6, keyName: "a"},
            1: {noteName: "d4", frequency: 293.7, keyName: "s"},
            2: {noteName: "e4", frequency: 329.6, keyName: "d"},
            3: {noteName: "f4", frequency: 349.2, keyName: "f"},
            4: {noteName: "g4", frequency: 392, keyName: "g"},
            5: {noteName: "a4", frequency: 440, keyName: "h"},
            6: {noteName: "b4", frequency: 493.9, keyName: "j"},
            7: {noteName: "c5", frequency: 523.3, keyName: "k"},
            8: {noteName: "d5", frequency: 587.3, keyName: "l"}
        };
    }

    playSound(isTypo = false) {
        let osc = this.audioCtx.createOscillator(); // Create oscillator node

        let randNum = Math.floor(Math.random() * 8);

        //音の種類を設定
        osc.type = "triangle";
        if (isTypo) { //タイプミスの場合
            osc.type = "sine";
            randNum = 0;
        }

        //周波数
        osc.frequency.value = this.notesByKeyCode[randNum].frequency;

        //音量設定の準備
        let gainNode = this.audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        gainNode.gain.value = 0.01;
        osc.start(0);

        osc.connect(this.audioCtx.destination);

        //音の停止
        setTimeout(() => {
            osc.stop(0);
            osc.disconnect();
        }, 100);
    }
}

let soundObj = new TypingSound();


/*
 -----------------------------------------------------------------------------
 abcdefghijklmnopqrstuvwxyz
 1234567890-^\!"#$%&'()=~|
 @[`{
 ;:]+*}
 ,./\<>?_


 #gb = [~0 | 6 & 9 ^ 7];
 f(r * 2 < 3.1 % 4 ) -> {
 `cmd :/say "how! 8k_tv xl $5 @jp\en' + ?quiz,
 }
 -----------------------------------------------------------------------------
 */




