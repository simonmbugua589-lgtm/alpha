<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
if (current_user()) { header('Location: dashboard.php'); exit; }

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $name = trim((string) ($_POST['full_name'] ?? ''));
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    $confirm = (string) ($_POST['confirm_password'] ?? '');
    if (text_length($name) < 2 || text_length($name) > 100) $error = 'Enter a name between 2 and 100 characters.';
    elseif (!preg_match('/^[A-Za-z0-9_]{3,24}$/', $username)) $error = 'Username must be 3–24 letters, numbers, or underscores.';
    elseif (strlen($password) < 8) $error = 'Password must be at least 8 characters.';
    elseif (!hash_equals($password, $confirm)) $error = 'Passwords do not match.';
    else {
        try {
            $statement = database()->prepare('INSERT INTO users (full_name, username, password_hash) VALUES (?, ?, ?)');
            $statement->execute([$name, $username, password_hash($password, PASSWORD_DEFAULT)]);
            set_flash('success', 'Your account is ready. Please sign in.');
            header('Location: login.php');
            exit;
        } catch (PDOException $exception) {
            $error = $exception->getCode() === '23000' ? 'That username is already in use.' : 'Unable to create the account right now.';
        }
    }
}
$page_title = 'Create Account';
require __DIR__ . '/header.php';
?>
<section class="auth-layout"><div class="auth-copy"><p class="eyebrow">START TODAY</p><h1>Create your Gold Mine account.</h1><p>Set up a secure member account in a few moments.</p><a href="index.php">Back to homepage</a></div>
<form class="auth-card" method="post" novalidate><h2>Create Account</h2><p>All fields are required.</p>
  <?php if ($error): ?><div class="form-error" role="alert"><?= h($error) ?></div><?php endif; ?>
  <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
  <label>Full name<input name="full_name" type="text" value="<?= h($_POST['full_name'] ?? '') ?>" autocomplete="name" minlength="2" maxlength="100" required></label>
  <label>Username<input name="username" type="text" value="<?= h($_POST['username'] ?? '') ?>" autocomplete="username" pattern="[A-Za-z0-9_]{3,24}" required></label>
  <label>Password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
  <label>Confirm password<input name="confirm_password" type="password" autocomplete="new-password" minlength="8" required></label>
  <button class="button button-block" type="submit">Create Account</button>
  <p class="form-foot">Already registered? <a href="login.php">Login</a></p>
</form></section>
<?php require __DIR__ . '/footer.php'; ?>
