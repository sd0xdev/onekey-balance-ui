<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { onMount } from 'svelte';
	import { Trash2, ChevronDown, Check, Copy } from '@lucide/svelte';

	export let currentChain = 'ethereum'; // 接收從父元件傳入的當前鏈
	export let currentAddress = ''; // 接收當前選中的地址，用於高亮顯示

	// 定義地址類型
	interface SavedAddress {
		chain: string;
		address: string;
		label?: string;
	}

	let savedAddresses: SavedAddress[] = [];
	let savedAddressesForCurrentChain: SavedAddress[] = [];
	let showDeleteConfirm = false;
	let addressToDelete: SavedAddress | null = null;
	let isDropdownOpen = false;
	let wasDeleted = false;

	// 創建事件分發器
	const dispatch = createEventDispatcher();

	// 當選擇鏈改變時，更新該鏈的地址列表
	$: {
		if (currentChain) {
			savedAddressesForCurrentChain = savedAddresses.filter((addr) => addr.chain === currentChain);
		}
	}

	// 選擇地址
	function selectAddress(address: string) {
		dispatch('addressSelect', { address });
		isDropdownOpen = false;
	}

	// 複製地址到剪貼板
	async function copyAddress(address: string) {
		try {
			await navigator.clipboard.writeText(address);
			// 顯示複製成功提示
			const button = document.querySelector(`[data-address="${address}"]`);
			if (button) {
				const originalInnerHTML = button.innerHTML;
				button.innerHTML = '<span class="text-[#05ffa1]">已複製!</span>';
				setTimeout(() => {
					button.innerHTML = originalInnerHTML;
				}, 1000);
			}
		} catch (err) {
			console.error('複製地址失敗:', err);
		}
	}

	// 保存新地址
	function saveAddress(address: string, label?: string) {
		const newAddress: SavedAddress = {
			chain: currentChain,
			address,
			label
		};

		// 檢查是否已存在
		const exists = savedAddresses.some(
			(addr) => addr.chain === currentChain && addr.address === address
		);

		if (!exists) {
			savedAddresses = [...savedAddresses, newAddress];
			// 儲存到localStorage
			if (typeof window !== 'undefined') {
				localStorage.setItem('savedAddresses', JSON.stringify(savedAddresses));
			}
		}

		// 更新當前鏈的地址列表
		savedAddressesForCurrentChain = savedAddresses.filter((addr) => addr.chain === currentChain);
	}

	// 從localStorage載入保存的地址
	function loadSavedAddresses() {
		if (typeof window === 'undefined') return;

		try {
			const saved = localStorage.getItem('savedAddresses');
			if (saved) {
				savedAddresses = JSON.parse(saved);
				savedAddressesForCurrentChain = savedAddresses.filter(
					(addr) => addr.chain === currentChain
				);
			}
		} catch (error) {
			console.error('載入保存的地址失敗:', error);
		}
	}

	// 確認刪除地址
	function confirmDelete(chain: string, address: string, event?: Event) {
		if (event) {
			event.stopPropagation();
		}
		// 查找要刪除的地址
		const addrToDelete = savedAddresses.find(
			(addr) => addr.chain === chain && addr.address === address
		);

		if (addrToDelete) {
			addressToDelete = addrToDelete;
			showDeleteConfirm = true;
		}
	}

	// 刪除地址
	function deleteAddress() {
		if (addressToDelete) {
			savedAddresses = savedAddresses.filter(
				(addr) =>
					!(addr.chain === addressToDelete?.chain && addr.address === addressToDelete?.address)
			);

			// 更新當前鏈的地址列表
			savedAddressesForCurrentChain = savedAddresses.filter((addr) => addr.chain === currentChain);

			// 儲存到localStorage
			if (typeof window !== 'undefined') {
				localStorage.setItem('savedAddresses', JSON.stringify(savedAddresses));
			}

			// 重設狀態
			showDeleteConfirm = false;
			addressToDelete = null;

			wasDeleted = true;
			setTimeout(() => {
				wasDeleted = false;
			}, 300);
		}
	}

	// 取消刪除
	function cancelDelete() {
		showDeleteConfirm = false;
		addressToDelete = null;
	}

	// 切換下拉選單
	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}

	// 點擊外部時關閉下拉選單
	function handleClickOutside(event: MouseEvent) {
		const dropdown = document.querySelector('.dropdown-content');
		if (dropdown && !dropdown.contains(event.target as Node) && isDropdownOpen) {
			const trigger = document.querySelector('.dropdown-trigger');
			if (trigger && !trigger.contains(event.target as Node)) {
				isDropdownOpen = false;
			}
		}
	}

	onMount(() => {
		loadSavedAddresses();

		// 監聽地址保存事件
		if (typeof window !== 'undefined') {
			window.addEventListener('addressesSaved', loadSavedAddresses);
			window.addEventListener('click', handleClickOutside);
		}

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('addressesSaved', loadSavedAddresses);
				window.removeEventListener('click', handleClickOutside);
			}
		};
	});
</script>

<div class="saved-addresses mb-6">
	<h3 class="mb-2 font-['Bodoni_Moda',serif] text-lg text-[#01cdfe]">已保存地址</h3>

	<div class="dropdown relative">
		<button
			class="dropdown-trigger flex w-full items-center justify-between rounded-lg border border-[#01cdfe]/30 bg-black/40 p-3 text-left transition-all hover:border-[#01cdfe]/60"
			class:highlight-pulse={wasDeleted}
			on:click={toggleDropdown}
		>
			{#if savedAddressesForCurrentChain.length === 0}
				<span class="text-[#01cdfe]/70">尚未為此鏈保存任何地址</span>
			{:else}
				<div>
					{#if currentAddress && savedAddressesForCurrentChain.some((addr) => addr.address === currentAddress)}
						{#each savedAddressesForCurrentChain.filter((addr) => addr.address === currentAddress) as current}
							<div class="flex flex-col">
								<div class="flex items-center gap-2">
									<span class="font-['MS_Gothic',monospace] text-[#fffb96]">
										{current.address.slice(0, 8)}...{current.address.slice(-6)}
									</span>
									{#if current.label}
										<span class="label-tag">{current.label}</span>
									{/if}
								</div>
							</div>
						{/each}
					{:else}
						<span class="text-[#01cdfe]">選擇已保存地址</span>
					{/if}
				</div>
			{/if}
			<ChevronDown
				size={16}
				class="text-[#01cdfe] transition-transform duration-200"
				style={isDropdownOpen ? 'transform: rotate(180deg)' : ''}
			/>
		</button>

		{#if isDropdownOpen && savedAddressesForCurrentChain.length > 0}
			<div
				class="dropdown-content absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-[#01cdfe]/30 bg-black/80 backdrop-blur-md"
			>
				<div class="max-h-64 overflow-y-auto p-1">
					{#each savedAddressesForCurrentChain as addr}
						<div
							class="address-item group flex items-center justify-between rounded-lg p-2 transition-all hover:bg-[#01cdfe]/10"
							class:selected={addr.address === currentAddress}
						>
							<button class="flex-1 text-left" on:click={() => selectAddress(addr.address)}>
								<div class="address-content flex items-center gap-2">
									{#if addr.address === currentAddress}
										<div class="address-check text-[#05ffa1]">
											<Check size={16} />
										</div>
									{:else}
										<div class="address-empty w-4"></div>
									{/if}

									<div>
										<div class="address-text font-['MS_Gothic',monospace] text-[#fffb96]">
											{addr.address.slice(0, 8)}...{addr.address.slice(-6)}
										</div>
										{#if addr.label}
											<div class="address-label mt-0.5 text-xs text-[#05ffa1]">{addr.label}</div>
										{/if}
									</div>
								</div>
							</button>

							<div class="flex gap-1">
								<button
									class="action-btn flex h-7 w-7 items-center justify-center rounded-full bg-transparent text-white/40 transition-all hover:bg-[#05ffa1]/20 hover:text-[#05ffa1]"
									on:click={(e) => {
										e.stopPropagation();
										copyAddress(addr.address);
									}}
									data-address={addr.address}
									title="複製地址"
								>
									<Copy size={14} />
								</button>
								<button
									class="action-btn flex h-7 w-7 items-center justify-center rounded-full bg-transparent text-white/40 transition-all hover:bg-[#ff71ce]/20 hover:text-[#ff71ce]"
									on:click={(e) => confirmDelete(addr.chain, addr.address, e)}
									aria-label="刪除地址"
									title="刪除地址"
								>
									<Trash2 size={14} />
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if showDeleteConfirm}
		<div
			class="delete-confirm-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
		>
			<div
				class="confirm-dialog max-w-sm rounded-xl border border-[#ff71ce]/30 bg-black/90 p-5 backdrop-blur-lg"
			>
				<h4 class="mb-4 text-xl text-[#ff71ce]">確認刪除</h4>
				<p class="mb-6 text-white">
					確定要刪除地址
					<span class="font-['MS_Gothic',monospace] text-[#fffb96]">
						{addressToDelete?.address
							? `${addressToDelete.address.slice(0, 8)}...${addressToDelete.address.slice(-6)}`
							: ''}
					</span>
					嗎？
				</p>
				<div class="flex justify-end gap-3">
					<button
						class="rounded-lg border border-white/30 bg-transparent px-4 py-2 text-white transition duration-300 hover:border-white"
						on:click={cancelDelete}
					>
						取消
					</button>
					<button
						class="rounded-lg bg-[#ff71ce]/20 px-4 py-2 font-bold text-[#ff71ce] transition duration-300 hover:bg-[#ff71ce]/30 hover:shadow-[0_0_15px_rgba(255,113,206,0.5)]"
						on:click={deleteAddress}
					>
						刪除
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* 自定義滾動條樣式 */
	.dropdown-content {
		scrollbar-width: thin;
		scrollbar-color: rgba(1, 205, 254, 0.2) transparent;
	}

	.dropdown-content::-webkit-scrollbar {
		width: 4px;
	}

	.dropdown-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.dropdown-content::-webkit-scrollbar-thumb {
		background-color: rgba(1, 205, 254, 0.2);
		border-radius: 10px;
	}

	.dropdown-content::-webkit-scrollbar-thumb:hover {
		background-color: rgba(1, 205, 254, 0.3);
	}

	/* 選中地址的樣式 */
	.address-item.selected {
		background-color: rgba(1, 205, 254, 0.15) !important;
		box-shadow: 0 0 12px rgba(1, 205, 254, 0.1);
	}

	.address-item.selected .address-icon {
		background-color: rgba(1, 205, 254, 0.3);
		color: white;
	}

	.address-item.selected .address-text {
		color: white;
	}

	.address-item.selected .address-label {
		color: #05ffa1;
		text-shadow: 0 0 5px rgba(5, 255, 161, 0.5);
	}

	.label-tag {
		display: inline-block;
		font-size: 0.75rem;
		padding: 0 0.5rem;
		border-radius: 9999px;
		background-color: rgba(5, 255, 161, 0.2);
		color: #05ffa1;
		text-shadow: 0 0 5px rgba(5, 255, 161, 0.5);
		border: 1px solid rgba(5, 255, 161, 0.3);
	}

	/* 動畫效果 */
	.confirm-dialog {
		animation: fadeIn 0.3s ease;
		box-shadow: 0 0 30px rgba(255, 113, 206, 0.2);
	}

	/* 高亮脈動效果 */
	@keyframes highlightPulse {
		0% {
			box-shadow: 0 0 0 0 rgba(1, 205, 254, 0.4);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(1, 205, 254, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(1, 205, 254, 0);
		}
	}

	.highlight-pulse {
		animation: highlightPulse 1s ease-in-out 2;
		border-color: rgba(1, 205, 254, 0.6) !important;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
