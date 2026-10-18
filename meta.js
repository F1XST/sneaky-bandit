(function () {
  const SB = (window.SB = window.SB || {});

  // Playable thieves. look = sprite colours, the other fields are gameplay modifiers.
  SB.CHARS = {
    bob: { price: 0, speed: 1, noise: 1, look: { shirt: '#2a2d43', stripe: '#eef0f6', skin: '#f1c9a0', cap: '#16161f' } },
    luna: { price: 250, speed: 0.96, noise: 0.5, look: { shirt: '#4a2f6b', stripe: '#d5c2ff', skin: '#f4cfb0', cap: '#2a1840' } },
    max: { price: 250, speed: 1.12, noise: 1.3, look: { shirt: '#c9661f', stripe: '#ffe0b0', skin: '#e0b088', cap: '#3a2210' } },
    iris: { price: 400, speed: 1, noise: 1, sleep: 1, decoy: 1, look: { shirt: '#1f6f6b', stripe: '#c5f5f0', skin: '#e8bd98', cap: '#10302e' } },
  };
  SB.CHAR_ORDER = ['bob', 'luna', 'max', 'iris'];

  // Permanent upgrades bought with coins.
  SB.UPGRADES = [
    { id: 'speed', max: 3, cost: [150, 300, 500], icon: '👟' },
    { id: 'rocks', max: 3, cost: [100, 200, 350], icon: ':rock' },
    { id: 'quiet', max: 3, cost: [150, 300, 450], icon: '🤫' },
    { id: 'time', max: 3, cost: [120, 240, 400], icon: '⏱' },
    { id: 'sleep', max: 2, cost: [250, 450], icon: '💤' },
    { id: 'decoy', max: 2, cost: [250, 450], icon: '🔔' },
    { id: 'disguise', max: 2, cost: [300, 500], icon: '🎭' },
    { id: 'shoes', max: 2, cost: [300, 500], icon: '👣' },
  ];

  SB.TOOLS = [
    { id: 'rock', icon: ':rock', key: '1', instant: false },
    { id: 'sleep', icon: '💤', key: '2', instant: false },
    { id: 'decoy', icon: '🔔', key: '3', instant: false },
    { id: 'disguise', icon: '🎭', key: '4', instant: true },
    { id: 'shoes', icon: '👣', key: '5', instant: true },
  ];

  SB.RADIO_RANGE = 300;

  // icons that are drawn with CSS because not every system font has the emoji
  SB.icon = (tok) => (tok === ':rock' ? '<span class="i-rock"></span>' : tok === ':coin' ? '<span class="i-coin"></span>' : tok);
})();
