document.addEventListener('DOMContentLoaded', () => {
  initAccountPage();
  setLastUpdated();
});

const readStorage = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readSessionStorage = (key, fallback = null) => {
  try {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeSessionStorage = (key, value) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the account view usable even if session storage is unavailable.
  }
};

const removeStoredUser = () => {
  sessionStorage.removeItem('dealett_user');
  localStorage.removeItem('dealett_user');
};

const getUserSession = () => {
  const user = readSessionStorage('dealett_user');
  if (user) return user;

  const legacyUser = readStorage('dealett_user');
  if (legacyUser) {
    writeSessionStorage('dealett_user', legacyUser);
    localStorage.removeItem('dealett_user');
    return legacyUser;
  }

  return null;
};

const getCheckoutSession = () => {
  const checkout = readSessionStorage('dealettCheckout');
  if (checkout) return checkout;

  const legacyCheckout = readStorage('dealettCheckout');
  if (legacyCheckout) {
    try {
      sessionStorage.setItem('dealettCheckout', JSON.stringify(legacyCheckout));
      localStorage.removeItem('dealettCheckout');
    } catch {
      // If migration fails, still allow this render to use the legacy value.
    }

    return legacyCheckout;
  }

  return {};
};

const setText = (id, value) => {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
};

const formatPrice = (value) => {
  if (window.DealettCart?.formatCurrency) {
    return `${window.DealettCart.formatCurrency(value)} kr`;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '0 kr';
  return `${number.toLocaleString('sv-SE')} kr`;
};

const getCart = () => window.DealettCart?.readCart() || readStorage('dealettCart', []);

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'DK';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'DK';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
};

const sumRewards = (rewards) => {
  if (!rewards || typeof rewards !== 'object') return 0;
  return Object.values(rewards).reduce((sum, value) => sum + Math.max(Number(value) || 0, 0), 0);
};

const setLastUpdated = () => {
  const formatted = new Date().toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  setText('lastUpdated', formatted);
};

const getActivePlan = () => {
  const savedPlan = readStorage('dealett_plan');
  if (savedPlan) return savedPlan;

  const cart = getCart();
  const checkout = getCheckoutSession();
  const firstItem = Array.isArray(cart) ? cart[0] : null;

  if (!firstItem) return null;

  return {
    name: firstItem.title || firstItem.data || 'Abonnemang',
    operator: firstItem.operator || 'Dealett',
    price: firstItem.price || 0,
    data: firstItem.data || firstItem.title || 'Ej angivet',
    startDate: checkout.startDate || 'Ej angivet',
    persons: firstItem.persons || 1,
  };
};

const getReward = () => {
  const savedReward = readStorage('dealett_reward');
  if (savedReward) return savedReward;

  const cart = getCart();
  const firstItem = Array.isArray(cart) ? cart[0] : null;
  const rewardDistribution = readStorage('rewardDistribution', firstItem?.rewards || {});
  const rewardTotal = Number(firstItem?.rewardTotal) || sumRewards(rewardDistribution);

  if (!rewardTotal) return null;

  const rewardNames = Object.entries(rewardDistribution || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([name]) => `${name}: XXX kr`);

  return {
    name: 'Presentkort: XXX kr',
    description: rewardNames.length
      ? rewardNames.join(' | ')
      : 'Presentkort kopplat till ditt valda abonnemang.',
  };
};

const setupPlan = (plan) => {
  const empty = document.getElementById('emptyPlanState');
  const content = document.getElementById('planContent');

  if (!plan) {
    setText('activePlan', 'Inget');
    setText('monthlyCost', '0 kr');
    setText('sidebarPlanName', 'Inget');
    empty?.classList.remove('hidden');
    content?.classList.add('hidden');
    return;
  }

  const planName = plan.name || 'Abonnemang';
  const operator = plan.operator || 'Dealett';
  const price = formatPrice(plan.price);
  const data = plan.data || 'Ej angivet';
  const startDate = plan.startDate || 'Ej angivet';

  setText('activePlan', planName);
  setText('monthlyCost', price);
  setText('sidebarPlanName', planName);
  setText('planNameHeading', planName);
  setText('planOperatorLine', operator);
  setText('planPriceBig', price);
  setText('planData', data);
  setText('planStartDate', startDate);

  empty?.classList.add('hidden');
  content?.classList.remove('hidden');
};

const setupReward = (reward) => {
  if (!reward) {
    setText('rewardStatus', 'Ingen');
    setText('rewardNameLarge', 'Ingen vald');
    setText('rewardDescription', 'Ingen bel\u00f6ning \u00e4r kopplad till ditt konto \u00e4nnu.');
    setText('sidebarRewardName', 'Ingen');
    return;
  }

  setText('rewardStatus', reward.name || 'Vald bel\u00f6ning');
  setText('rewardNameLarge', reward.name || 'Vald bel\u00f6ning');
  setText('rewardDescription', reward.description || 'Din valda bel\u00f6ning visas h\u00e4r.');
  setText('sidebarRewardName', reward.name || 'Vald bel\u00f6ning');
};

const initAccountPage = () => {
  const user = getUserSession();

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const userName = user.name || 'Kund';
  const initials = getInitials(userName);

  setText('userName', userName);
  setText('sidebarUserName', userName);
  setText('profileNameCard', userName);
  setText('userInitials', initials);
  setText('avatarCircle', initials);
  setText('accountStatusLabel', user.authMode === 'bankid' ? 'BankID' : 'Demo');
  setText('accountTypeLabel', user.authMode === 'bankid' ? 'Verifierat' : 'Testsida');
  setText('sidebarStatusLabel', user.authMode === 'bankid' ? 'BankID' : 'Demo');
  setText('profileModeLabel', user.authMode === 'bankid' ? 'BankID-verifierad' : 'Demoprofil');

  setupPlan(getActivePlan());
  setupReward(getReward());

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    removeStoredUser();
    window.location.href = 'index.html';
  });

  document.getElementById('cancelPlan')?.addEventListener('click', () => {
    const confirmed = window.confirm('Vill du avsluta ditt abonnemang?');
    if (!confirmed) return;

    localStorage.removeItem('dealett_plan');
    if (window.DealettCart?.clearCart) {
      window.DealettCart.clearCart();
    } else {
      localStorage.removeItem('dealettCart');
      localStorage.removeItem('selectedOffer');
      localStorage.removeItem('rewardDistribution');
      localStorage.removeItem('dealettState');
      localStorage.removeItem('dealettCheckout');
      sessionStorage.removeItem('dealettCheckout');
    }
    window.location.reload();
  });
};
