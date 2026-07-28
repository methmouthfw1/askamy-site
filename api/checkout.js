const Stripe = require('stripe');

// Price IDs live in Vercel env vars so nothing sensitive sits in the repo.
// Set these in Vercel > askamy-site > Settings > Environment Variables.
const PLANS = {
  starter: [process.env.PRICE_STARTER_SETUP, process.env.PRICE_STARTER_MONTHLY],
  core:    [process.env.PRICE_CORE_SETUP,    process.env.PRICE_CORE_MONTHLY],
  pro:     [process.env.PRICE_PRO_SETUP,     process.env.PRICE_PRO_MONTHLY],
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(500).json({ error: 'Stripe is not configured yet.' });
    return;
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const plan = (req.body && req.body.plan ? String(req.body.plan) : '').toLowerCase();
    const prices = PLANS[plan];

    if (!prices) {
      res.status(400).json({ error: 'Unknown plan.' });
      return;
    }

    const line_items = prices
      .filter(Boolean)
      .map((price) => ({ price, quantity: 1 }));

    if (!line_items.length) {
      res.status(500).json({ error: 'No price IDs set for that plan yet.' });
      return;
    }

    const origin =
      req.headers.origin ||
      (req.headers.host ? 'https://' + req.headers.host : 'https://askamycall.com');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      subscription_data: { metadata: { plan } },
      metadata: { plan },
      success_url: origin + '/thanks.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/#pricing',
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('checkout error:', err && err.message);
    res.status(500).json({ error: 'Could not start checkout.' });
  }
};
