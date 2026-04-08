/**
 * MY SAKE WORLD - Google Apps Script バックエンド
 *
 * ===== デプロイ手順 =====
 * 1. 対象スプレッドシート (ID: 1zvOH6pB2i3NLn0_15IzjrHmDHIJbI2j1dPQ1aA3UYMw) を開く
 * 2. メニュー「拡張機能」→「Apps Script」を開く
 * 3. このコードを全て貼り付けて保存（Ctrl+S）
 * 4. 【初回のみ】関数「initialize」を選択して「実行」→シートを初期化
 * 5. 「デプロイ」→「新しいデプロイ」をクリック
 * 6. 種類の選択: 「ウェブアプリ」を選択
 * 7. 説明: 任意（例: MY SAKE WORLD API）
 * 8. 次のユーザーとして実行: 「自分」
 * 9. アクセスできるユーザー: 「全員」
 * 10. 「デプロイ」ボタンをクリック → 権限の承認を行う
 * 11. 表示された「ウェブアプリのURL」をコピー
 * 12. index.html / brewery.html / admin.html の GAS_URL 変数にそのURLを貼り付ける
 *
 * ===== 更新時の手順 =====
 * コードを修正した場合は「デプロイ」→「デプロイを管理」→「編集」→「バージョン: 新しいバージョン」で再デプロイ
 */

// ===== 定数 =====
const SPREADSHEET_ID      = '1zvOH6pB2i3NLn0_15IzjrHmDHIJbI2j1dPQ1aA3UYMw';
const RECIPE_SHEET_NAME   = 'レシピ';
const SAKE_SHEET_NAME     = '酒リスト';
const SETTINGS_SHEET_NAME = '設定';

// ===== CORSヘッダー付きレスポンス生成 =====
function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ===== GETリクエスト処理 =====
function doGet(e) {
  const action = e.parameter.action;
  const role   = e.parameter.role;

  try {
    switch (action) {
      case 'getSakeList':
        return createJsonResponse(getSakeList());
      case 'getOrders':
        return createJsonResponse(getOrders(role));
      case 'getFormSettings':
        return createJsonResponse(getFormSettings());
      default:
        return createJsonResponse({ error: '不明なアクションです: ' + action });
    }
  } catch (err) {
    return createJsonResponse({ error: err.toString() });
  }
}

// ===== POSTリクエスト処理 =====
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return createJsonResponse({ error: 'JSONパースエラー: ' + err.toString() });
  }

  const action = data.action;

  try {
    switch (action) {
      case 'submitRecipe':
        return createJsonResponse(submitRecipe(data));
      case 'addSake':
        return createJsonResponse(addSake(data.name));
      case 'deleteSake':
        return createJsonResponse(deleteSake(data.name));
      case 'updateStatus':
        return createJsonResponse(updateStatus(data.id));
      case 'updateFormSettings':
        return createJsonResponse(updateFormSettings(data));
      default:
        return createJsonResponse({ error: '不明なアクションです: ' + action });
    }
  } catch (err) {
    return createJsonResponse({ error: err.toString() });
  }
}

// ===== 酒リスト取得 =====
function getSakeList() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SAKE_SHEET_NAME);
  if (!sheet) return { list: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return { list: [] };

  const values = sheet.getRange(1, 1, lastRow, 1).getValues();
  const list   = values.map(row => row[0]).filter(v => v !== '');
  return { list };
}

// ===== 注文一覧取得 =====
function getOrders(role) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RECIPE_SHEET_NAME);
  if (!sheet) return { orders: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { orders: [] };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows    = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  // 新着を先頭に表示するため逆順に並べ替え
  const orders = rows.reverse().map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });

  if (role === 'brewery') {
    // 酒蔵用：個人情報を除いたフィールドのみ返却
    return {
      orders: orders.map(o => ({
        識別番号  : o['識別番号'],
        受信日時  : o['受信日時'],
        レシピ名  : o['レシピ名'],
        ブレンダー名: o['ブレンダー名'],
        ラベル色  : o['ラベル色'],
        酒1名: o['酒1名'], 酒1ml: o['酒1ml'],
        酒2名: o['酒2名'], 酒2ml: o['酒2ml'],
        酒3名: o['酒3名'], 酒3ml: o['酒3ml'],
        酒4名: o['酒4名'], 酒4ml: o['酒4ml'],
        酒5名: o['酒5名'], 酒5ml: o['酒5ml'],
        酒6名: o['酒6名'], 酒6ml: o['酒6ml'],
        酒7名: o['酒7名'], 酒7ml: o['酒7ml'],
        酒8名: o['酒8名'], 酒8ml: o['酒8ml'],
        確認済み: o['確認済み']
      }))
    };
  }

  // 管理者用：全カラム返却
  return { orders };
}

// ===== フォーム設定取得 =====
function getFormSettings() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) return getDefaultFormSettings();

  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return getDefaultFormSettings();

  const values   = sheet.getRange(1, 1, lastRow, 2).getValues();
  const settings = {};
  values.forEach(row => { if (row[0]) settings[String(row[0])] = row[1]; });

  return {
    labelOptions: settings['label_options']
      ? String(settings['label_options']).split(',').map(s => s.trim()).filter(s => s)
      : ['白ラベル', '黒ラベル'],
    targetMl : parseInt(settings['target_ml']) || 40,
    maxRows  : parseInt(settings['max_rows'])  || 8,
    guideText: settings['guide_text'] !== undefined && settings['guide_text'] !== ''
      ? String(settings['guide_text'])
      : 'お好みのお酒を組み合わせてオリジナルブレンドを作りましょう'
  };
}

// ===== デフォルト設定（設定シートが存在しない場合）=====
function getDefaultFormSettings() {
  return {
    labelOptions: ['白ラベル', '黒ラベル'],
    targetMl    : 40,
    maxRows     : 8,
    guideText   : 'お好みのお酒を組み合わせてオリジナルブレンドを作りましょう'
  };
}

// ===== フォーム設定更新（キー単位）=====
function updateFormSettings(data) {
  if (!data.key) throw new Error('設定キーが必要です');

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SETTINGS_SHEET_NAME);

  const lastRow = sheet.getLastRow();
  let found = false;

  if (lastRow > 0) {
    const keys = sheet.getRange(1, 1, lastRow, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i][0] === data.key) {
        sheet.getRange(i + 1, 2).setValue(String(data.value));
        found = true;
        break;
      }
    }
  }

  if (!found) {
    sheet.appendRow([data.key, String(data.value)]);
  }

  return { success: true };
}

// ===== レシピ送信 =====
function submitRecipe(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RECIPE_SHEET_NAME);
  if (!sheet) throw new Error('レシピシートが見つかりません');

  // 識別番号・日時を生成
  const id      = generateId(sheet);
  const now     = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  // 行データを組み立て
  const row = [
    id,
    dateStr,
    data.recipeName  || '',
    data.blenderName || '',
    data.labelColor  || '',
  ];

  // 最大8種のブレンドデータ（酒名・ml を交互に格納）
  for (let i = 0; i < 8; i++) {
    const blend = data.blends && data.blends[i];
    row.push(blend ? (blend.name || '') : '');
    row.push(blend ? (blend.ml   || '') : '');
  }

  // 個人情報
  row.push(data.fullName || '');
  row.push(data.email    || '');
  row.push(data.phone    || '');
  row.push(data.address  || '');
  row.push(''); // 確認済みフラグ（初期値: 空）

  sheet.appendRow(row);

  return { success: true, id };
}

// ===== 識別番号生成（MSW-YYYYMMDD-0001形式）=====
function generateId(sheet) {
  const now     = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyyMMdd');
  const prefix  = 'MSW-' + dateStr + '-';

  // 今日付けの最大連番を検索
  let maxSeq  = 0;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(row => {
      const id = String(row[0]);
      if (id.startsWith(prefix)) {
        const seq = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
  }

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return prefix + nextSeq;
}

// ===== お酒を追加 =====
function addSake(name) {
  if (!name || name.trim() === '') throw new Error('お酒の名前が必要です');
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SAKE_SHEET_NAME);
  if (!sheet) throw new Error('酒リストシートが見つかりません');
  sheet.appendRow([name.trim()]);
  return { success: true };
}

// ===== お酒を削除 =====
function deleteSake(name) {
  if (!name) throw new Error('お酒の名前が必要です');
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SAKE_SHEET_NAME);
  if (!sheet) throw new Error('酒リストシートが見つかりません');

  const lastRow = sheet.getLastRow();
  for (let i = lastRow; i >= 1; i--) {
    const val = sheet.getRange(i, 1).getValue();
    if (val === name) {
      sheet.deleteRow(i);
      return { success: true };
    }
  }
  throw new Error('対象のお酒が見つかりません: ' + name);
}

// ===== 確認済みステータスを更新 =====
function updateStatus(id) {
  if (!id) throw new Error('識別番号が必要です');
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RECIPE_SHEET_NAME);
  if (!sheet) throw new Error('レシピシートが見つかりません');

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  for (let i = 2; i <= lastRow; i++) {
    const rowId = sheet.getRange(i, 1).getValue();
    if (String(rowId) === String(id)) {
      sheet.getRange(i, lastCol).setValue('✓');
      return { success: true };
    }
  }
  throw new Error('対象の注文が見つかりません: ' + id);
}

// ===== 初期設定（初回のみ手動実行）=====
function initialize() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // --- 酒リストシートの初期化 ---
  let sakeSheet = ss.getSheetByName(SAKE_SHEET_NAME);
  if (!sakeSheet) {
    sakeSheet = ss.insertSheet(SAKE_SHEET_NAME);
  }
  sakeSheet.clearContents();

  const initialSakeList = [
    ['龍勢'],
    ['英勲'],
    ['神蔵'],
    ['神聖'],
    ['にいだしぜんしゅ'],
    ['抱腹絶倒'],
    ['TAMA'],
    ['2013ヴィンテージ']
  ];
  sakeSheet.getRange(1, 1, initialSakeList.length, 1).setValues(initialSakeList);

  // --- レシピシートの初期化 ---
  let recipeSheet = ss.getSheetByName(RECIPE_SHEET_NAME);
  if (!recipeSheet) {
    recipeSheet = ss.insertSheet(RECIPE_SHEET_NAME);
  }

  // ヘッダー行を設定（既存データがある場合は上書きしない）
  const headers = [
    '識別番号', '受信日時', 'レシピ名', 'ブレンダー名', 'ラベル色',
    '酒1名', '酒1ml', '酒2名', '酒2ml',
    '酒3名', '酒3ml', '酒4名', '酒4ml',
    '酒5名', '酒5ml', '酒6名', '酒6ml',
    '酒7名', '酒7ml', '酒8名', '酒8ml',
    'お名前', 'メール', '電話', '配送先住所', '確認済み'
  ];
  if (recipeSheet.getLastRow() === 0) {
    recipeSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // --- 設定シートの初期化 ---
  let settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SETTINGS_SHEET_NAME);
  }
  settingsSheet.clearContents();

  const initialSettings = [
    ['label_options', '白ラベル,黒ラベル'],
    ['target_ml',     '40'],
    ['max_rows',      '8'],
    ['guide_text',    'お好みのお酒を組み合わせてオリジナルブレンドを作りましょう']
  ];
  settingsSheet.getRange(1, 1, initialSettings.length, 2).setValues(initialSettings);

  Logger.log('✅ 初期設定が完了しました');
  Logger.log('酒リスト: ' + initialSakeList.length + '件登録');
  Logger.log('設定シート: ' + initialSettings.length + '項目登録');
}
