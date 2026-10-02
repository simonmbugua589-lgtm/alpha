<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
if (current_user()) { header('Location: dashboard.php'); exit; }

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    if (!login_allowed()) {
        $error = 'Too many login attempts. Please wait 15 minutes and try again.';
    } elseif (!preg_match('/^[A-Za-z0-9_]{3,24}$/', $username) || $password === '') {
        $error = 'Enter your username and password.';
    } else {
        $statement = database()->prepare('SELECT id, password_hash, status FROM users WHERE username = ? LIMIT 1');
        $statement->execute([$username]);
        $account = $statement->fetch();
        if ($account && $account['status'] === 'active' && password_verify($password, $account['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['user_id'] = (int) $account['id'];
            clear_login_attempts();
            header('Location: dashboard.php');
            exit;
        }
        record_failed_login();
        $error = 'Invalid username or password.';
    }
}
$page_title = 'Login';
require __DIR__ . '/header.php';
?>
<section class="auth-layout"><div class="auth-copy"><p class="eyebrow">MEMBER ACCESS</p><h1>Welcome back to Gold Mine.</h1><p>Sign in to see your private investment workspace.</p><a href="index.php">Back to homepage</a></div>
<form class="auth-card" method="post" novalidate><h2>Login</h2><p>Use your username and password.</p>
  <?php if ($error): ?><div class="form-error" role="alert"><?= h($error) ?></div><?php endif; ?>
  <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
  <label>Username<input name="username" type="text" value="<?= h($_POST['username'] ?? '') ?>" autocomplete="username" minlength="3" maxlength="24" required></label>
  <label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required></label>
  <button class="button button-block" type="submit">Sign In</button>
  <p class="form-foot">New here? <a href="register.php">Create an account</a></p>
</form></section>
<?php require __DIR__ . '/footer.php'; ?>
