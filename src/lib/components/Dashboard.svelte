<script lang="ts">
	import { onMount } from 'svelte';
	import { balanceStore } from '$lib/stores/balance';
	import { chainsStore } from '$lib/stores/chains';
	import ChainSelector from './ChainSelector.svelte';
	import AddressInput from './AddressInput.svelte';
	import SavedAddresses from './SavedAddresses.svelte';

	// 獲取資產數據
	let assets: { name: string; value: number; change: number; icon: string }[] = [];
	let totalValue = 0;
	let totalChange = 0;
	let nftCount = 0;

	// 監聽 balanceStore 的變化
	const unsubscribe = balanceStore.subscribe(({ data, isLoading, error }) => {
		if (data) {
			// 處理原生代幣
			const nativeAsset = {
				name: data.nativeBalance.symbol,
				value: data.nativeBalance.usd,
				change: 0, // API 沒有提供變化百分比，設為 0
				icon: getIconForToken(data.nativeBalance.symbol)
			};

			// 處理 ERC20 代幣
			const tokenAssets = data.tokens.slice(0, 3).map((token) => ({
				name: token.symbol,
				value: token.usd,
				change: 0, // API 沒有提供變化百分比，設為 0
				icon: getIconForToken(token.symbol)
			}));

			// 組合資產列表（原生代幣 + 最多 3 個 ERC20 代幣）
			assets = [nativeAsset, ...tokenAssets];

			// 計算總價值（原生代幣 + 所有 ERC20 代幣）
			totalValue = data.nativeBalance.usd + data.tokens.reduce((sum, token) => sum + token.usd, 0);

			// 獲取 NFT 數量
			nftCount = data.nfts.length;
		}
	});

	// 根據代幣符號返回圖標
	function getIconForToken(symbol: string): string {
		const icons: Record<string, string> = {
			ETH: '⟠',
			BTC: '₿',
			SOL: '◎',
			MATIC: '⬡',
			USDT: '₮',
			USDC: '₵'
		};

		return icons[symbol] || '🪙';
	}

	let isAnimating = true;

	onMount(() => {
		// 加載資產數據
		balanceStore.fetchBalance().catch((err) => {
			console.error('獲取餘額失敗:', err);
		});

		// 獲取區塊鏈列表
		chainsStore.fetchChains().catch((err) => {
			console.error('獲取區塊鏈列表失敗:', err);
		});

		setTimeout(() => {
			isAnimating = false;
		}, 1500);

		return () => {
			unsubscribe();
		};
	});

	// 3D 網格效果參數
	let mouseX = 0;
	let mouseY = 0;
	let windowX = 0;
	let windowY = 0;

	function handleMouseMove(e: MouseEvent) {
		// 計算相對位置 -1 到 1 之間
		mouseX = (e.clientX / windowX - 0.5) * 2;
		mouseY = (e.clientY / windowY - 0.5) * 2;
	}

	onMount(() => {
		windowX = window.innerWidth;
		windowY = window.innerHeight;

		window.addEventListener('resize', () => {
			windowX = window.innerWidth;
			windowY = window.innerHeight;
		});
	});

	// 更新時間
	let currentTime = new Date().toLocaleTimeString();

	function updateTime() {
		currentTime = new Date().toLocaleTimeString();
	}

	setInterval(updateTime, 1000);
</script>

<svelte:window on:mousemove={handleMouseMove} />

<div class="fixed h-full w-full overflow-auto bg-[#0a0c15] p-4 sm:p-8" style="perspective: 1000px;">
	<div class="vhs-scanlines absolute z-10 h-full w-full"></div>
	<div
		class="grid-floor perspective-effect absolute z-0 h-full w-full"
		style="transform: rotateX({45 + mouseY * 5}deg) rotateY({mouseX * 5}deg) translateZ(-10px);"
	></div>

	<!-- 主標題區 -->
	<div class="relative z-20 mb-12 py-8 text-center">
		<div class="relative inline-block">
			<h1
				class="relative mb-4 text-4xl font-bold tracking-wider sm:text-6xl"
				style="text-shadow: 0 0 15px rgba(185, 103, 255, 0.5);"
			>
				<span
					class="animate-pulse bg-gradient-to-r from-[#ff71ce] via-[#b967ff] to-[#01cdfe] bg-clip-text font-['Bodoni_Moda',serif] text-transparent"
				>
					ONEKEY BALANCE
				</span>
			</h1>
			<div class="cyberpunk-line"></div>
		</div>
		<p class="mt-2 flex items-center justify-center gap-3 text-lg">
			<span class="font-['MS_Gothic',monospace] text-[#fffb96]">SYSTEM.STATUS:</span>
			<span class="online-tag">
				{$balanceStore.isLoading ? 'LOADING' : $balanceStore.error ? 'ERROR' : 'ONLINE'}
			</span>
		</p>
	</div>

	<!-- 選擇區塊鏈與地址 -->
	<div
		class="chain-selector-panel pulse-glow-pink relative z-20 mx-auto mb-8 max-w-screen-lg overflow-hidden rounded-3xl bg-black/40 backdrop-blur"
	>
		<div class="panel-glow"></div>
		<div class="relative p-6 sm:p-8">
			<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
				<h2 class="glow-text font-['Bodoni_Moda',serif] text-xl text-[#ff71ce]">
					選擇區塊鏈與地址
				</h2>
				<ChainSelector />
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div>
					<AddressInput />
				</div>
				<div>
					<SavedAddresses />
				</div>
			</div>
		</div>
	</div>

	<!-- 主卡片 -->
	<div
		class="main-panel pulse-glow-cyan relative z-20 mx-auto mb-8 max-w-screen-lg overflow-hidden rounded-3xl bg-black/40 backdrop-blur"
	>
		<div class="panel-glow"></div>
		<div class="relative p-6 sm:p-8">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="glow-text font-['Bodoni_Moda',serif] text-[#05ffa1]">資產總覽</h2>
				<div class="flex items-center gap-4">
					<div class="wallet-address font-['MS_Gothic',monospace] text-xs text-[#fffb96]">
						{$balanceStore.address.slice(0, 6)}...{$balanceStore.address.slice(-4)}
					</div>
					<div class="digital-time font-['MS_Gothic',monospace]">{currentTime}</div>
				</div>
			</div>

			<div class="bg-gradient relative mb-8 overflow-hidden rounded-2xl p-4">
				<div class="absolute inset-[1px] z-0 rounded-2xl bg-black/80"></div>
				<div
					class="relative z-10 flex items-baseline justify-between text-3xl font-bold text-white sm:text-5xl"
				>
					<span class="glow-text text-[#05ffa1]"
						>${totalValue.toLocaleString(undefined, {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2
						})}</span
					>
					<span class="change-indicator {totalChange >= 0 ? 'positive' : 'negative'}">
						{totalChange >= 0 ? '+' : ''}{totalChange}%
					</span>
				</div>
			</div>

			{#if $balanceStore.isLoading}
				<div class="py-8 text-center">
					<div class="loading-spinner mb-4"></div>
					<p class="text-[#fffb96]">正在載入資產資料...</p>
				</div>
			{:else if $balanceStore.error}
				<div class="py-8 text-center text-[#ff71ce]">
					<p>載入失敗: {$balanceStore.error}</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{#each assets as asset, i}
						<div
							class="asset-card delay-card-{i + 1} {isAnimating ? 'fade-up' : ''} 
							hover-glow relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-sm"
						>
							<div class="asset-icon">{asset.icon}</div>
							<div class="flex-1">
								<div class="font-['MS_Gothic',monospace] text-sm text-[#fffb96]">{asset.name}</div>
								<div class="price-highlight text-lg font-bold">
									${asset.value.toLocaleString(undefined, {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2
									})}
								</div>
								<div class="mt-1 text-xs {asset.change >= 0 ? 'positive' : 'negative'}">
									{asset.change >= 0 ? '+' : ''}{asset.change}%
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- 次要區域 -->
	<div class="mx-auto grid max-w-screen-lg grid-cols-1 gap-8 sm:grid-cols-2">
		<!-- NFT 展示區 -->
		<div
			class="nft-panel secondary-panel pulse-glow-yellow relative z-20 overflow-hidden rounded-3xl bg-black/40 backdrop-blur"
		>
			<div class="panel-glow"></div>
			<div class="relative p-6 sm:p-8">
				<h2 class="glow-text font-['Bodoni_Moda',serif] text-[#fffb96]">NFT 收藏</h2>
				<div class="mt-2 mb-4 flex items-baseline gap-2">
					<span class="font-['MS_Gothic',monospace] text-3xl text-[#fffb96]">{nftCount}</span>
					<span class="font-body text-white">件藏品</span>
				</div>
				{#if $balanceStore.data?.nfts && $balanceStore.data.nfts.length > 0}
					<div class="grid grid-cols-2 gap-3">
						{#each $balanceStore.data.nfts.slice(0, 4) as nft, i}
							<div class="nft-item hover-glow" style="background-image: url({nft.image || ''})">
								{#if !nft.image}
									<div class="nft-placeholder-text">{nft.name || `NFT #${nft.tokenId}`}</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-3">
						<div class="nft-placeholder hover-glow"></div>
						<div class="nft-placeholder hover-glow"></div>
						<div class="nft-placeholder hover-glow"></div>
						<div class="nft-placeholder hover-glow"></div>
					</div>
				{/if}
			</div>
		</div>

		<!-- 資產分佈 -->
		<div
			class="assets-panel secondary-panel pulse-glow-mint relative z-20 overflow-hidden rounded-3xl bg-black/40 backdrop-blur"
		>
			<div class="panel-glow"></div>
			<div class="relative p-6 sm:p-8">
				<h2 class="glow-text font-['Bodoni_Moda',serif] text-[#01cdfe]">資產分佈</h2>
				<div class="mt-4 space-y-3">
					{#if $balanceStore.data}
						<div
							class="token-stats hover-glow flex items-center gap-4 rounded-xl border border-white/20 bg-black/80 p-3 transition-all hover:translate-x-1 hover:border-[#05ffa1]"
						>
							<div class="token-type native">原生</div>
							<div class="flex-1">
								<div class="font-bold">
									<span class="glow-text text-[#fffb96]"
										>{$balanceStore.data.nativeBalance.symbol}:</span
									>
									<span class="price-highlight"
										>${$balanceStore.data.nativeBalance.usd.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2
										})}</span
									>
								</div>
								<div class="mt-1 text-xs text-[#fffb96]">
									{parseFloat($balanceStore.data.nativeBalance.balance) /
										10 ** $balanceStore.data.nativeBalance.decimals}
									{$balanceStore.data.nativeBalance.symbol}
								</div>
							</div>
						</div>
						<div
							class="token-stats hover-glow flex items-center gap-4 rounded-xl border border-white/20 bg-black/80 p-3 transition-all hover:translate-x-1 hover:border-[#05ffa1]"
						>
							<div class="token-type erc20">代幣</div>
							<div class="flex-1">
								<div class="font-bold text-[#fffb96]">
									代幣數量: <span class="glow-text text-white"
										>{$balanceStore.data.tokens.length}</span
									>
								</div>
								<div class="mt-1 text-xs text-[#fffb96]">
									總值: <span class="price-highlight"
										>${$balanceStore.data.tokens
											.reduce((sum, token) => sum + token.usd, 0)
											.toLocaleString(undefined, {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2
											})}</span
									>
								</div>
							</div>
						</div>
					{:else}
						<div
							class="transaction-item hover-glow flex items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-3 transition-all hover:translate-x-1 hover:border-[#05ffa1]"
						>
							<div class="transaction-type send">發送</div>
							<div class="flex-1">
								<div class="font-bold text-white">0.25 ETH</div>
								<div class="mt-1 text-xs text-white/60">2小時前</div>
							</div>
						</div>
						<div
							class="transaction-item hover-glow flex items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-3 transition-all hover:translate-x-1 hover:border-[#05ffa1]"
						>
							<div class="transaction-type receive">接收</div>
							<div class="flex-1">
								<div class="font-bold text-white">500 USDT</div>
								<div class="mt-1 text-xs text-white/60">昨天</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
