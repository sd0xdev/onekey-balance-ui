<script>
	import '../app.css';
</script>

<svelte:head>
	<link
		href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=Noto+Serif+SC:wght@700&family=Bodoni+Moda:wght@700&family=Press+Start+2P&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div style="min-height: 100vh; background-color: #111827;">
	<!-- 背景裝飾 - 格子地面 -->
	<div class="grid-floor fixed inset-0 -z-10"></div>

	<!-- VHS 掃描線效果 -->
	<div class="vhs-scanlines fixed inset-0 -z-10"></div>

	<!-- 頂部導航 -->
	<nav class="border-b border-[var(--vwave-pink)]/20 backdrop-blur-sm">
		<div class="container mx-auto flex items-center justify-between px-4 py-4">
			<a
				href="/"
				class="font-retro drop-shadow-glow bg-gradient-to-r from-[var(--vwave-pink)] to-[var(--vwave-cyan)] bg-clip-text text-2xl text-transparent transition-all hover:from-[var(--vwave-mint)] hover:to-[var(--vwave-lav)]"
			>
				<span class="font-display">OneKey</span> Balance
			</a>

			<div class="flex gap-4">
				<a
					href="https://github.com/onekey/balance"
					target="_blank"
					class="text-[var(--vwave-sun)] transition-colors hover:text-[var(--vwave-mint)]"
				>
					GitHub
				</a>
				<a
					href="/about"
					class="text-[var(--vwave-sun)] transition-colors hover:text-[var(--vwave-mint)]"
				>
					關於
				</a>
			</div>
		</div>
	</nav>

	<main>
		<slot />
	</main>

	<!-- 頁腳 -->
	<footer class="mt-12 border-t border-[var(--vwave-pink)]/20 py-6">
		<div class="container mx-auto px-4 text-center text-[var(--vwave-lav)]">
			<p class="font-retro text-xs">© 2025 OneKey Balance • SD0</p>
		</div>
	</footer>
</div>
