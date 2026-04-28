// server/game-logic.js
// -------------------------------------------------------------------
// 섯다 게임 규칙을 전담하는 파일입니다.
// 요구사항에 맞춰 서버 권위(authoritative server) 모델로 작성합니다.
// 즉, 카드 생성 / 셔플 / 분배 / 족보 판정 / 승패 비교는 모두 서버가 처리합니다.
// 클라이언트는 서버가 전달한 결과만 화면에 그립니다.
// -------------------------------------------------------------------

/**
 * 섯다 카드 덱 생성.
 * 단순 20장(1월~10월, 각 월 2장) 구조입니다.
 * 광 카드는 1월, 3월, 8월의 A 카드로만 취급합니다.
 */
function createDeck() {
  const deck = [];

  for (let month = 1; month <= 10; month += 1) {
    deck.push({
      id: `${month}-A`,
      month,
      copy: 'A',
      isKwang: month === 1 || month === 3 || month === 8,
    });

    deck.push({
      id: `${month}-B`,
      month,
      copy: 'B',
      isKwang: false,
    });
  }

  return deck;
}

/**
 * Fisher-Yates 셔플.
 */
function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 덱에서 n장을 꺼냅니다.
 */
function drawCards(deck, count) {
  const cards = [];
  for (let i = 0; i < count; i += 1) {
    const card = deck.shift();
    if (!card) break;
    cards.push(card);
  }
  return cards;
}

function getSortedMonths(cards) {
  return cards.map((c) => c.month).sort((a, b) => a - b);
}

function isExactPair(cards, a, b) {
  const months = getSortedMonths(cards);
  return months[0] === Math.min(a, b) && months[1] === Math.max(a, b);
}

function isDdang(cards, month) {
  return cards[0].month === month && cards[1].month === month;
}

function getKwangDdangName(cards) {
  const allKwang = cards.every((c) => c.isKwang);
  if (!allKwang) return null;

  if (isExactPair(cards, 3, 8)) return '3·8광땡';
  if (isExactPair(cards, 1, 8)) return '1·8광땡';
  if (isExactPair(cards, 1, 3)) return '1·3광땡';

  return null;
}

/**
 * 섯다 족보 판정.
 * rankValue가 클수록 강한 패입니다.
 * replay=true인 경우는 구사(9·4) 재경기 패입니다.
 */
function evaluateHand(cards) {
  if (!cards || cards.length !== 2) {
    throw new Error('evaluateHand에는 반드시 카드 2장이 필요합니다.');
  }

  const kwangDdang = getKwangDdangName(cards);
  if (kwangDdang) {
    const valueMap = {
      '3·8광땡': 100,
      '1·8광땡': 99,
      '1·3광땡': 98,
    };

    return {
      rankValue: valueMap[kwangDdang],
      name: kwangDdang,
      type: '광땡',
      note: '최상급 광땡 패입니다.',
      replay: false,
      cards,
    };
  }

  for (let month = 10; month >= 1; month -= 1) {
    if (isDdang(cards, month)) {
      return {
        rankValue: 80 + month,
        name: month === 10 ? '장땡' : `${month}땡`,
        type: '땡',
        note: '같은 월 두 장으로 만든 땡 패입니다.',
        replay: false,
        cards,
      };
    }
  }

  const specialHands = [
    { pair: [1, 2], name: '알리', rankValue: 79, note: '강한 특수 족보입니다.', replay: false },
    { pair: [1, 4], name: '독사', rankValue: 78, note: '강한 특수 족보입니다.', replay: false },
    { pair: [1, 9], name: '구삥', rankValue: 77, note: '강한 특수 족보입니다.', replay: false },
    { pair: [1, 10], name: '장삥', rankValue: 76, note: '강한 특수 족보입니다.', replay: false },
    { pair: [4, 10], name: '장사', rankValue: 75, note: '강한 특수 족보입니다.', replay: false },
    { pair: [4, 6], name: '세륙', rankValue: 74, note: '강한 특수 족보입니다.', replay: false },
    {
      pair: [4, 9],
      name: '구사',
      rankValue: 73,
      note: '구사입니다. 현재 판돈을 유지한 채 재경기합니다.',
      replay: true,
    },
  ];

  for (const hand of specialHands) {
    if (isExactPair(cards, hand.pair[0], hand.pair[1])) {
      return {
        rankValue: hand.rankValue,
        name: hand.name,
        type: '특수',
        note: hand.note,
        replay: hand.replay,
        cards,
      };
    }
  }

  const points = (cards[0].month + cards[1].month) % 10;

  return {
    rankValue: 60 + points,
    name: points === 9 ? '갑오' : points === 0 ? '망통' : `${points}끗`,
    type: '끗',
    points,
    note: points === 9 ? '끗 패 중 가장 높은 갑오입니다.' : `${points}끗 상태입니다.`,
    replay: false,
    cards,
  };
}

function compareHands(a, b) {
  if (a.rankValue > b.rankValue) return 1;
  if (a.rankValue < b.rankValue) return -1;
  return 0;
}

function findWinners(playerHands) {
  if (!playerHands || playerHands.length === 0) {
    return [];
  }

  let best = playerHands[0].hand;
  for (let i = 1; i < playerHands.length; i += 1) {
    if (compareHands(playerHands[i].hand, best) === 1) {
      best = playerHands[i].hand;
    }
  }

  return playerHands.filter((entry) => compareHands(entry.hand, best) === 0);
}

function formatCard(card) {
  return {
    id: card.id,
    month: card.month,
    label: `${card.month}월`,
    isKwang: card.isKwang,
    copy: card.copy,
  };
}

/**
 * 현재 2장 패를 사람이 읽기 쉬운 문장으로 요약합니다.
 * 예: 6월 + 7월 = 3끗
 */
function summarizeHand(cards) {
  const hand = evaluateHand(cards);
  const months = cards.map((card) => `${card.month}월`).join(' + ');
  return {
    name: hand.name,
    type: hand.type,
    note: hand.note || '',
    replay: !!hand.replay,
    text: `${months} = ${hand.name}`,
  };
}

module.exports = {
  createDeck,
  shuffleDeck,
  drawCards,
  evaluateHand,
  compareHands,
  findWinners,
  formatCard,
  summarizeHand,
};
