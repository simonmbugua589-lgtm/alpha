<?php
declare(strict_types=1);
$page_title = 'Secure Investment Platform';
require __DIR__ . '/header.php';
?>
<section class="hero">
  <div class="hero-copy">
    <p class="eyebrow">GOLD MINE INVESTMENTS</p>
    <h1>Build your future with a clear view of every investment.</h1>
    <p class="lead">A refined, secure workspace for tracking your balance, earnings, investments, and support requests.</p>
    <div class="hero-actions">
      <a class="button" href="register.php">Create Account</a>
      <a class="button button-outline" href="login.php">Login</a>
    </div>
  </div>
  <div class="hero-panel">
    <p class="panel-label">YOUR WORKSPACE</p>
    <div class="metric"><span>Investment overview</span><strong>Always available</strong></div>
    <div class="metric"><span>Account security</span><strong>Protected login</strong></div>
    <div class="metric"><span>Member support</span><strong>Here when needed</strong></div>
  </div>
</section>
<section class="feature-band" aria-label="Platform features">
  <article><h2>Clear tracking</h2><p>Follow balances, earnings, investments, and withdrawals in one private dashboard.</p></article>
  <article><h2>Protected access</h2><p>Every account uses secure sessions and password hashing to protect your information.</p></article>
  <article><h2>Helpful support</h2><p>Send a support request directly from your dashboard whenever you need assistance.</p></article>
</section>
<?php require __DIR__ . '/footer.php'; ?>
