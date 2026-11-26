// ===== 字表来源：年级 + 课次选择（数据来自 oraclelist.csv） =====
const ALL_KEY = 'ALL';          // 整个年级
const CUSTOM_KEY = 'CUSTOM';    // 自定义字表
const STORAGE_KEY = 'oraclematch.selection';

let GRADES = {};                // { 年级: { 课次: [{ char, oracle }] } }
let ORACLE_OF = new Map();      // 汉字 → 甲骨文字（自定义字表查找用）

const gradeSelect = document.getElementById('gradeSelect');
const lessonSelect = document.getElementById('lessonSelect');
const wordCountInput = document.getElementById('wordCount');   // 每局字数
const flipModeInput = document.getElementById('flipMode');     // 翻翻乐模式
const wordInput = document.getElementById('wordInput');        // 自定义字表

function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
}

function saveSelection() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            grade: gradeSelect.value, lesson: lessonSelect.value, count: wordCountInput.value,
            flip: flipModeInput.checked, custom: wordInput.value
        }));
    } catch (e) { /* 忽略 */ }
}

function addOption(select, value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    select.appendChild(opt);
}

function hasOption(select, value) {
    return [...select.options].some(o => o.value === value);
}

async function initSelectors() {
    try {
        GRADES = await loadOracleList();
    } catch (err) {
        GRADES = {};
        document.getElementById('lessonInfo').textContent = oracleListErrorMessage(err);
    }
    for (const w of allWords(GRADES)) if (!ORACLE_OF.has(w.char)) ORACLE_OF.set(w.char, w.oracle);

    for (const grade in GRADES) addOption(gradeSelect, grade, grade);
    if (gradeSelect.options.length === 0) addOption(gradeSelect, '', '（无字库）');

    const saved = loadSaved();
    if (saved.count && hasOption(wordCountInput, saved.count)) wordCountInput.value = saved.count;
    flipModeInput.checked = !!saved.flip;
    if (typeof saved.custom === 'string') wordInput.value = saved.custom;
    if (saved.grade && hasOption(gradeSelect, saved.grade)) gradeSelect.value = saved.grade;
    fillLessonOptions();
    if (saved.lesson && hasOption(lessonSelect, saved.lesson)) lessonSelect.value = saved.lesson;
    else if (gradeSelect.value === '') lessonSelect.value = CUSTOM_KEY;

    updateLessonInfo();
}

function fillLessonOptions() {
    const grade = gradeSelect.value;
    lessonSelect.innerHTML = '';
    if (GRADES[grade]) {
        addOption(lessonSelect, ALL_KEY, `整个${grade}`);
        for (const lesson in GRADES[grade]) {
            addOption(lessonSelect, lesson, `${lesson}（${GRADES[grade][lesson].length} 字）`);
        }
    }
    addOption(lessonSelect, CUSTOM_KEY, '自定义字表');
}

function onGradeChange() {
    fillLessonOptions();
    updateLessonInfo();
}

function lessonLabel() {
    const key = lessonSelect.value;
    if (key === CUSTOM_KEY) return '自定义字表';
    if (key === ALL_KEY) return `整个${gradeSelect.value}`;
    return `${gradeSelect.value} · ${key}`;
}

// 课次预览：每个字上面是甲骨文，下面是楷书
function renderPreview(entries) {
    const preview = document.getElementById('lessonPreview');
    preview.innerHTML = '';
    for (const e of entries) {
        const chip = document.createElement('span');
        chip.className = 'preview-chip';
        const o = document.createElement('span');
        o.className = 'oracle-font';
        o.textContent = e.oracle;
        const c = document.createElement('span');
        c.className = 'kaiti-font';
        c.textContent = e.char;
        chip.append(o, c);
        preview.appendChild(chip);
    }
    preview.classList.toggle('hidden', entries.length === 0);
}

function updateLessonInfo() {
    const grade = gradeSelect.value;
    const key = lessonSelect.value;
    const info = document.getElementById('lessonInfo');
    const customArea = document.getElementById('customArea');

    saveSelection();

    // 自定义字表用全部输入的字，不显示字数
    document.getElementById('countPicker').classList.toggle('hidden', key === CUSTOM_KEY);

    if (key === CUSTOM_KEY) {
        customArea.classList.remove('hidden');
        const { found, missing } = parseCustomInput();
        let text = found.length ? `可以配对的字：${found.length} 个` : '';
        if (missing.length) text += `${text ? '；' : ''}没有甲骨文、不会出现：${missing.join(' ')}`;
        if (ORACLE_OF.size) info.textContent = text;   // 字库没读到时保留错误提示
        renderPreview(found);
        return;
    }

    customArea.classList.add('hidden');

    if (key === ALL_KEY) {
        const n = Object.keys(GRADES[grade]).length;
        const entries = gradeWords(GRADES, grade);
        info.textContent = `共 ${n} 课 ${entries.length} 字，${roundText(entries)}`;
        renderPreview(entries);
    } else {
        const entries = GRADES[grade][key] || [];
        info.textContent = `共 ${entries.length} 字，${roundText(entries)}`;
        renderPreview(entries);
    }
}

function roundSize() {
    return parseInt(wordCountInput.value, 10) || 10;
}

function roundText(entries) {
    const n = roundSize();
    return entries.length > n ? `每局随机抽取 ${n} 字` : '每局全部使用';
}

// 自定义字表：输入任意汉字（可以夹空格、标点、换行），只保留有甲骨文的字
function parseCustomInput() {
    const chars = [...new Set(Array.from(wordInput.value).filter(ch => /\p{Script=Han}/u.test(ch)))];
    const found = [], missing = [];
    for (const ch of chars) {
        if (ORACLE_OF.has(ch)) found.push({ char: ch, oracle: ORACLE_OF.get(ch) });
        else missing.push(ch);
    }
    return { found, missing };
}

// 同一个字只出现一次
function uniqueByChar(entries) {
    const seen = new Set();
    return entries.filter(e => !seen.has(e.char) && seen.add(e.char));
}

// 根据当前课次生成本局字表
function buildWords() {
    const grade = gradeSelect.value;
    const key = lessonSelect.value;
    if (key === CUSTOM_KEY) return parseCustomInput().found;
    const pool = uniqueByChar(key === ALL_KEY ? gradeWords(GRADES, grade) : (GRADES[grade] || {})[key] || []);
    shuffleArray(pool);
    return pool.slice(0, roundSize());
}

// ===== 游戏 =====
let words = [];
let cards = [];
let selectedCards = [];
let matchedPairs = 0;
const PREVIEW_SECONDS = 3;   // 翻翻乐：开始前看卡片的秒数
let flipMode = false;
let previewing = false;
let previewTimer = null;
let totalPairs = 0;
let startTime = null;
let timerInterval = null;

// 音效生成器
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'correct') {
    if (audioContext.state === 'suspended') audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'correct') {
        // 正确音效：愉快的上升音调
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, audioContext.currentTime + duration);
        oscillator.type = 'sine';
    } else {
        // 错误音效：低沉的音调
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'triangle';
    }

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function startGame() {
    words = buildWords();

    if (words.length === 0) {
        if (lessonSelect.value === CUSTOM_KEY) {
            alert('请输入有甲骨文的汉字！');
        } else {
            alert('这个课次没有字！');
        }
        return;
    }

    document.getElementById('gameLesson').textContent = lessonLabel();

    // 显示游戏界面
    document.getElementById('inputScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    document.body.classList.add('playing');

    initGame();
}

function initGame() {
    // 每个字一对卡片：甲骨文卡 + 楷书卡
    cards = [];
    words.forEach((word, wordIndex) => {
        cards.push({ type: 'oracle', value: word.oracle, oracle: word.oracle, wordIndex });
        cards.push({ type: 'character', value: word.char, oracle: word.oracle, wordIndex });
    });
    totalPairs = words.length;

    // 随机打散
    shuffleArray(cards);

    // 渲染游戏板
    const gameBoard = document.getElementById('gameBoard');
    gameBoard.innerHTML = '';

    cards.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card ' + (card.type === 'oracle' ? 'card-oracle' : 'card-char');
        cardElement.textContent = card.value;
        cardElement.dataset.index = index;
        cardElement.onclick = () => selectCard(index);
        gameBoard.appendChild(cardElement);
    });

    // 重置游戏状态
    selectedCards = [];
    matchedPairs = 0;

    fitBoard();

    // 翻翻乐：先给 3 秒看卡片，然后全部翻过去，再开始计时
    clearTimeout(previewTimer);
    flipMode = flipModeInput.checked;
    if (flipMode) {
        previewing = true;
        let left = PREVIEW_SECONDS;
        const timerEl = document.getElementById('timer');
        clearInterval(timerInterval);
        const tick = () => {
            if (left > 0) {
                timerEl.textContent = `记住卡片！${left}`;
                left--;
                previewTimer = setTimeout(tick, 1000);
            } else {
                document.querySelectorAll('.card').forEach(el => setFaceDown(el, true));
                previewing = false;
                startTimer();
            }
        };
        tick();
    } else {
        previewing = false;
        startTimer();
    }
}

// 翻牌（带翻转动画）
function setFaceDown(el, down) {
    el.classList.toggle('face-down', down);
    el.classList.remove('flip');
    void el.offsetWidth;   // 重新触发动画
    el.classList.add('flip');
}

// ===== 根据屏幕大小排列卡片，尽量让所有卡片一屏显示 =====
function fitBoard() {
    const board = document.getElementById('gameBoard');
    const n = cards.length;
    if (!n || board.offsetParent === null) return;

    const W = board.clientWidth;
    const H = board.clientHeight;
    const gap = Math.max(4, Math.min(14, Math.min(W, H) / 50));

    let best = null;
    for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const cellW = (W - gap * (cols - 1)) / cols;
        const cellH = (H - gap * (rows - 1)) / rows;
        if (cellW <= 0 || cellH <= 0) continue;
        const h = Math.min(cellH, cellW * 1.15);      // 卡片不要太瘦长
        const w = Math.min(cellW, h * 1.3);           // 也不要太扁
        const size = Math.min(h, w);
        if (!best || size > best.size + 0.01) best = { cols, w, h, size };
    }
    if (!best) return;

    board.style.gap = gap + 'px';
    board.style.gridTemplateColumns = `repeat(${best.cols}, ${Math.floor(best.w)}px)`;
    board.style.gridAutoRows = Math.floor(best.h) + 'px';
    // 字号设上限，卡片少时不会大得夸张
    board.style.setProperty('--char-font', Math.max(14, Math.floor(Math.min(best.size * 0.68, 96))) + 'px');
}

window.addEventListener('resize', fitBoard);

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function selectCard(index) {
    const cardElement = document.querySelectorAll('.card')[index];

    // 如果已经选中或已匹配，忽略
    if (cardElement.classList.contains('selected') ||
        cardElement.classList.contains('matched')) {
        return;
    }

    // 如果已经选了两张，或翻翻乐还在预览，忽略
    if (selectedCards.length >= 2 || previewing) {
        return;
    }

    // 翻翻乐：点开翻回正面
    if (flipMode) setFaceDown(cardElement, false);

    cardElement.classList.add('selected');
    selectedCards.push({ index, card: cards[index] });

    if (selectedCards.length === 2) {
        checkMatch();
    }
}

function checkMatch() {
    const [first, second] = selectedCards;

    // 一张甲骨文卡 + 一张楷书卡，且是同一个字（甲骨文字形相同）
    const isMatch = first.card.type !== second.card.type && first.card.oracle === second.card.oracle;

    if (isMatch) {
        playSound(523.25, 0.2, 'correct'); // C5音

        setTimeout(() => {
            const cardElements = document.querySelectorAll('.card');
            cardElements[first.index].classList.add('matched');
            cardElements[second.index].classList.add('matched');

            cardElements[first.index].classList.remove('selected');
            cardElements[second.index].classList.remove('selected');

            matchedPairs++;
            selectedCards = [];

            if (matchedPairs === totalPairs) {
                setTimeout(gameComplete, 500);
            }
        }, 300);
    } else {
        playSound(196.00, 0.3, 'wrong'); // G3音

        setTimeout(() => {
            const cardElements = document.querySelectorAll('.card');
            cardElements[first.index].classList.remove('selected');
            cardElements[second.index].classList.remove('selected');
            // 翻翻乐：配不上就两张都翻回去
            if (flipMode) {
                setFaceDown(cardElements[first.index], true);
                setFaceDown(cardElements[second.index], true);
            }
            selectedCards = [];
        }, flipMode ? 1000 : 800);
    }
}

function startTimer() {
    clearInterval(timerInterval);
    startTime = Date.now();
    updateTimer();
    timerInterval = setInterval(updateTimer, 100);
}

function updateTimer() {
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById('timer').textContent =
        `时间：${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function gameComplete() {
    clearInterval(timerInterval);
    const finalTime = document.getElementById('timer').textContent.replace('时间：', '');
    document.getElementById('finalTime').textContent = finalTime;
    document.getElementById('successModal').style.display = 'flex';
}

function replayGame() {
    document.getElementById('successModal').style.display = 'none';
    // 每局重新随机抽字
    words = buildWords();
    initGame();
}

function backToMenu() {
    clearInterval(timerInterval);
    clearTimeout(previewTimer);
    document.body.classList.remove('playing');
    document.getElementById('successModal').style.display = 'none';
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('inputScreen').classList.remove('hidden');
}


// 先加载字体，避免卡片上先显示系统字体
document.fonts?.load('1em FZOracle', '日');
document.fonts?.load('1em OracleKaiti', '日');
initSelectors();
