<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
$user = require_login();
$section = $_GET['section'] ?? 'overview';
if (!in_array($section, ['overview', 'support', 'comments'], true)) $section = 'overview';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    if (($_POST['action'] ?? '') === 'ticket') {
        $subject = trim((string) ($_POST['subject'] ?? ''));
        $message = trim((string) ($_POST['message'] ?? ''));
        if (text_length($subject) >= 3 && text_length($subject) <= 150 && text_length($message) >= 10 && text_length($message) <= 2000) {
            try {
                database()->prepare('INSERT INTO tickets (user_id, subject, message) VALUES (?, ?, ?)')->execute([$user['id'], $subject, $message]);
                set_flash('success', 'Your support request has been sent.');
            } catch (PDOException $exception) {
                set_flash('error', 'Your support request could not be saved. Please try again.');
            }
        } else set_flash('error', 'Use a subject of 3–150 characters and a message of 10–2,000 characters.');
        header('Location: dashboard.php?section=support'); exit;
    }
    if (($_POST['action'] ?? '') === 'comment') {
        $message = trim((string) ($_POST['message'] ?? ''));
        if (text_length($message) >= 3 && text_length($message) <= 600) {
            try {
                database()->prepare('INSERT INTO comments (user_id, message) VALUES (?, ?)')->execute([$user['id'], $message]);
                set_flash('success', 'Your comment was submitted for review.');
            } catch (PDOException $exception) {
                set_flash('error', 'Your comment could not be saved. Please try again.');
            }
        } else set_flash('error', 'Your comment must be 3–600 characters.');
        header('Location: dashboard.php?section=comments'); exit;
    }
}

$page_title = 'Dashboard';
require __DIR__ . '/header.php';
$money = static fn ($amount): string => '$' . number_format((float) $amount, 2);
?>
<section class="dashboard-shell">
  <aside class="dashboard-nav"><p class="dashboard-user">Signed in as <strong><?= h($user['username']) ?></strong></p>
    <a class="<?= $section === 'overview' ? 'active' : '' ?>" href="dashboard.php">Overview</a>
    <a class="<?= $section === 'support' ? 'active' : '' ?>" href="dashboard.php?section=support">Support</a>
    <a class="<?= $section === 'comments' ? 'active' : '' ?>" href="dashboard.php?section=comments">Comments</a>
    <a href="logout.php">Logout</a>
  </aside>
  <div class="dashboard-main">
    <div class="dashboard-heading"><div><p class="eyebrow">MEMBER DASHBOARD</p><h1>Welcome back, <?= h($user['full_name']) ?>.</h1></div><a class="button button-small" href="logout.php">Logout</a></div>
    <?php if ($section === 'overview'): ?>
      <div class="stats-grid"><article class="stat-card"><span>Available balance</span><strong><?= $money($user['balance']) ?></strong></article><article class="stat-card"><span>Total invested</span><strong><?= $money($user['invested']) ?></strong></article><article class="stat-card"><span>Monthly earnings</span><strong><?= $money($user['monthly_earnings']) ?></strong></article><article class="stat-card"><span>Total withdrawn</span><strong><?= $money($user['total_withdrawn']) ?></strong></article></div>
      <section class="content-card"><h2>Today’s activity</h2><div class="activity-row"><span>Today’s earnings</span><strong><?= $money($user['today_earnings']) ?></strong></div><div class="activity-row"><span>Account status</span><strong class="status-active">Active</strong></div><p class="muted">Use the navigation to contact support or share a comment with the Gold Mine team.</p></section>
    <?php elseif ($section === 'support'): ?>
      <?php $ticket_query = database()->prepare('SELECT subject, message, status, created_at FROM tickets WHERE user_id = ? ORDER BY created_at DESC'); $ticket_query->execute([$user['id']]); $tickets = $ticket_query->fetchAll(); ?>
      <section class="content-card"><h2>Contact support</h2><form method="post" class="stack-form"><input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>"><input type="hidden" name="action" value="ticket"><label>Subject<input name="subject" maxlength="150" required></label><label>Message<textarea name="message" rows="5" maxlength="2000" required></textarea></label><button class="button" type="submit">Send Request</button></form></section>
      <section class="content-card"><h2>Your requests</h2><?php foreach ($tickets as $ticket): ?><article class="list-item"><div><strong><?= h($ticket['subject']) ?></strong><p><?= h($ticket['message']) ?></p></div><span class="status-tag"><?= h(ucfirst($ticket['status'])) ?></span></article><?php endforeach; ?><?php if (!$tickets): ?><p class="muted">No support requests yet.</p><?php endif; ?></section>
    <?php else: ?>
      <?php $comment_query = database()->prepare('SELECT c.message, c.status, c.created_at, u.username FROM comments c JOIN users u ON u.id = c.user_id WHERE c.status = "approved" OR c.user_id = ? ORDER BY c.created_at DESC LIMIT 30'); $comment_query->execute([$user['id']]); $comments = $comment_query->fetchAll(); ?>
      <section class="content-card"><h2>Share a comment</h2><form method="post" class="stack-form"><input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>"><input type="hidden" name="action" value="comment"><label>Your comment<textarea name="message" rows="4" maxlength="600" required></textarea></label><button class="button" type="submit">Submit Comment</button></form></section>
      <section class="content-card"><h2>Community comments</h2><?php foreach ($comments as $comment): ?><article class="list-item"><div><strong><?= h($comment['username']) ?></strong><p><?= h($comment['message']) ?></p></div><span class="status-tag"><?= h($comment['status']) ?></span></article><?php endforeach; ?></section>
    <?php endif; ?>
  </div>
</section>
<?php require __DIR__ . '/footer.php'; ?>
