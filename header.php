<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
$page_title = $page_title ?? 'Gold Mine';
$logged_in_user = current_user();
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Gold Mine secure investment platform">
  <title><?= h($page_title) ?> | Gold Mine</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="index.php"><span class="brand-mark">GM</span><span>GOLD MINE</span></a>
  <button class="menu-button" type="button" aria-label="Open navigation" aria-expanded="false" data-menu-button>Menu</button>
  <nav class="site-nav" data-site-nav>
    <a href="index.php">Home</a>
    <?php if ($logged_in_user): ?>
      <a href="dashboard.php">Dashboard</a>
      <a class="button button-small button-outline" href="logout.php">Logout</a>
    <?php else: ?>
      <a href="login.php">Login</a>
      <a class="button button-small" href="register.php">Create Account</a>
    <?php endif; ?>
  </nav>
</header>
<main>
<?php if ($flash = get_flash()): ?>
  <div class="flash flash-<?= h($flash['type']) ?>" role="status"><?= h($flash['message']) ?></div>
<?php endif; ?>
