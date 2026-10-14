/**
 * 학교 축구 리그 관리 - 구글 시트 저장소 (Google Apps Script)
 *
 * 이 코드는 선생님 구글 시트에 붙여넣어 사용합니다. (설정 방법: README.md)
 * - 접속 코드, 시트 주소 같은 비밀값은 코드에 적지 않습니다.
 *   접속 코드는 시트 메뉴 [⚽ 축구리그 → 접속 코드 만들기]로 만들고 스크립트 속성에만 저장됩니다.
 * - 프로그램 전체 기록은 숨김 시트 "_data"에 저장되고,
 *   사람이 보기 쉬운 "경기결과" 시트가 저장할 때마다 자동으로 새로 만들어집니다.
 */

var DATA_SHEET = '_data';
var RESULT_SHEET = '경기결과';
var CHUNK = 45000; // 셀 한 칸 최대 50,000자 → 나눠서 저장

/* ---------- 시트 메뉴 ---------- */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚽ 축구리그')
    .addItem('접속 코드 만들기 / 바꾸기', 'createAccessCode')
    .addItem('접속 코드 확인', 'showAccessCode')
    .addSeparator()
    .addItem('경기결과 시트 새로 만들기', 'rebuildResultSheet')
    .addToUi();
}

function createAccessCode() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('ACCESS_CODE')) {
    var ok = ui.alert('접속 코드 바꾸기', '새 코드를 만들면 기존 코드로 연결된 PC·휴대폰은 다시 연결해야 합니다. 계속할까요?', ui.ButtonSet.YES_NO);
    if (ok !== ui.Button.YES) return;
  }
  // 헷갈리기 쉬운 글자(0, O, 1, l, I)는 빼고 10자리 무작위 코드 생성
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var code = '';
  var bytes = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  for (var i = 0; i < 10; i++) {
    code += chars.charAt(parseInt(bytes.substr(i * 2, 2), 16) % chars.length);
  }
  props.setProperty('ACCESS_CODE', code);
  ui.alert('접속 코드', '접속 코드: ' + code + '\n\n축구 리그 프로그램의 [💾 백업·연결] 탭 → 구글 시트 연결에 입력하세요.\n이 코드는 다른 사람에게 알려 주지 마세요.', ui.ButtonSet.OK);
}

function showAccessCode() {
  var code = PropertiesService.getScriptProperties().getProperty('ACCESS_CODE');
  SpreadsheetApp.getUi().alert(code ? '접속 코드: ' + code : '아직 접속 코드가 없습니다. [접속 코드 만들기]를 먼저 실행하세요.');
}

/* ---------- 웹 요청 처리 ---------- */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkCode(code) {
  var saved = PropertiesService.getScriptProperties().getProperty('ACCESS_CODE');
  if (!saved) return 'not_configured';
  if (!code || String(code).trim().toUpperCase() !== saved) return 'bad_code';
  return '';
}

function currentVersion() {
  return Number(PropertiesService.getScriptProperties().getProperty('DATA_VERSION') || 0);
}

// 연결 확인용 (접속 코드 불필요, 기록은 돌려주지 않음)
function doGet(e) {
  return json({ ok: true, app: 'school-soccer-league' });
}

// 모든 요청은 POST (접속 코드가 주소에 남지 않도록)
//  읽기: { action:'read', code }
//  쓰기: { action:'write', code, baseVersion, data }
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (x) {
    return json({ ok: false, error: 'bad_request' });
  }
  var err = checkCode(body.code);
  if (err) return json({ ok: false, error: err });
  if (body.action === 'read') {
    return json({ ok: true, version: currentVersion(), data: readData(), updatedAt: PropertiesService.getScriptProperties().getProperty('UPDATED_AT') || '' });
  }
  if (body.action !== 'write' || !body.data || !Array.isArray(body.data.tournaments)) {
    return json({ ok: false, error: 'bad_request' });
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json({ ok: false, error: 'busy' });
  try {
    var ver = currentVersion();
    // 다른 기기가 먼저 저장했으면 덮어쓰지 않고 최신 기록을 돌려줌
    if (Number(body.baseVersion) !== ver && !body.force) {
      return json({ ok: false, error: 'conflict', version: ver, data: readData() });
    }
    writeData(body.data);
    var next = ver + 1;
    var now = new Date().toISOString();
    PropertiesService.getScriptProperties().setProperties({ DATA_VERSION: String(next), UPDATED_AT: now });
    try { buildResultSheet(body.data); } catch (x) { /* 보기용 시트 오류는 저장에 영향 없음 */ }
    return json({ ok: true, version: next, updatedAt: now });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 저장/읽기 ---------- */
function dataSheet() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DATA_SHEET);
    sh.hideSheet();
    sh.getRange('A1').setNote('축구 리그 프로그램 저장 공간입니다. 직접 고치지 마세요.');
  }
  return sh;
}

function readData() {
  var sh = dataSheet();
  var last = sh.getLastRow();
  if (last < 1) return null;
  var text = sh.getRange(1, 1, last, 1).getValues().map(function (r) { return r[0]; }).join('');
  if (!text) return null;
  try { return JSON.parse(text); } catch (x) { return null; }
}

function writeData(data) {
  var sh = dataSheet();
  var text = JSON.stringify(data);
  var rows = [];
  for (var i = 0; i < text.length; i += CHUNK) rows.push([text.substr(i, CHUNK)]);
  sh.clearContents();
  // 숫자처럼 보이는 조각이 변형되지 않도록 문자열 서식 지정
  var range = sh.getRange(1, 1, rows.length, 1);
  range.setNumberFormat('@');
  range.setValues(rows);
}

/* ---------- 보기용 "경기결과" 시트 ---------- */
function rebuildResultSheet() {
  var data = readData();
  if (!data) { SpreadsheetApp.getUi().alert('아직 저장된 기록이 없습니다.'); return; }
  buildResultSheet(data);
}

function buildResultSheet(data) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(RESULT_SHEET) || ss.insertSheet(RESULT_SHEET, 0);
  sh.clear();
  var out = [['대회', '번호', '구분', '날짜', '시간', '장소', '홈', '홈 점수', '원정 점수', '원정', '승부차기', '상태', '득점 기록', '경고·퇴장', '메모']];
  (data.tournaments || []).forEach(function (t) {
    var teamName = function (id) {
      for (var i = 0; i < t.teams.length; i++) if (t.teams[i].id === id) return t.teams[i].name;
      return '';
    };
    var pname = function (e, key) {
      var id = e[key + 'Id'];
      if (id) for (var i = 0; i < t.players.length; i++) if (t.players[i].id === id) return t.players[i].name;
      return e[key + 'Name'] || '';
    };
    var side = function (m, s) {
      if (m[s + 'Id']) return teamName(m[s + 'Id']);
      var src = m[s + 'Src'];
      if (src && src.type === 'RANK') return '리그 ' + src.rank + '위';
      return '미정';
    };
    (t.matches || []).slice().sort(function (a, b) { return a.order - b.order; }).forEach(function (m) {
      var h = 0, a = 0, goals = [], cards = [];
      (m.events || []).forEach(function (e) {
        if (e.type === 'goal') { if (e.side === 'home') h++; else a++; goals.push(pname(e, 'player') + (e.minute ? "(" + e.minute + "')" : '')); }
        if (e.type === 'owngoal') { if (e.side === 'home') a++; else h++; goals.push(pname(e, 'player') + '(자책)'); }
        if (e.type === 'yellow') cards.push('경고 ' + pname(e, 'player'));
        if (e.type === 'red') cards.push('퇴장 ' + pname(e, 'player'));
      });
      var done = m.status === 'done';
      out.push([t.name, m.no, m.label || '', m.date || '', m.time || '', m.field || '', side(m, 'home'),
        done ? h : '', done ? a : '', side(m, 'away'),
        m.pk && m.pk.h !== '' && m.pk.h != null ? m.pk.h + ':' + m.pk.a : '', done ? '종료' : '예정',
        goals.join(', '), cards.join(', '), m.note || '']);
    });
  });
  sh.getRange(1, 1, out.length, out[0].length).setValues(out);
  sh.getRange(1, 1, 1, out[0].length).setFontWeight('bold').setBackground('#e3f4ea');
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, out[0].length).setNote('이 시트는 프로그램에서 저장할 때마다 자동으로 다시 만들어집니다. 여기서 고친 내용은 프로그램에 반영되지 않습니다.');
}
