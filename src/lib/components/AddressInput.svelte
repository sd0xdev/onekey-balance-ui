<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { X, Check, Save, Edit, Clipboard } from '@lucide/svelte';

	export let currentAddress = ''; // 接收從父元件傳入的當前地址
	export let currentChain = 'ethereum'; // 接收當前鏈，用於保存地址

	let address = currentAddress || '';
	let labelInput = ''; // 用於保存地址時的標籤
	let isValid = true;
	let errorMessage = '';
	let showSaveForm = false; // 控制顯示保存表單
	let isEditing = false; // 控制是否顯示輸入框
	let currentLabel = ''; // 當前地址的標籤
	let hasSavedAddresses = false; // 是否有已保存的地址
	let inputElement: HTMLInputElement; // 引用輸入元素

	// 創建事件分發器
	const dispatch = createEventDispatcher();

	// 監聽導出的地址變化
	$: {
		if (currentAddress && currentAddress !== address && !isEditing) {
			address = currentAddress;
			loadAddressLabel();
		}
	}

	// 加載地址標籤
	function loadAddressLabel() {
		if (typeof window === 'undefined') return;

		try {
			const savedAddresses = localStorage.getItem('savedAddresses');
			if (savedAddresses) {
				const addresses = JSON.parse(savedAddresses);
				// 檢查是否有任何已保存地址
				hasSavedAddresses = addresses.length > 0;

				// 檢查當前地址是否已保存
				const savedAddress = addresses.find(
					(addr: any) => addr.chain === currentChain && addr.address === address
				);

				if (savedAddress && savedAddress.label) {
					currentLabel = savedAddress.label;
				} else {
					currentLabel = '';
				}
			} else {
				hasSavedAddresses = false;
				currentLabel = '';
			}
		} catch (err) {
			console.error('載入地址標籤失敗:', err);
			currentLabel = '';
		}
	}

	// 開始編輯
	function startEditing() {
		address = currentAddress || '';
		isEditing = true;
		// 在下一個事件循環中聚焦輸入框
		setTimeout(() => {
			if (inputElement) {
				inputElement.focus();
				inputElement.select(); // 選擇全部文字以便於編輯
			}
		}, 50);
	}

	// 取消編輯
	function cancelEditing() {
		isEditing = false;
		address = currentAddress;
		loadAddressLabel();
	}

	// 清空地址
	function clearAddress() {
		if (inputElement) {
			address = '';
			inputElement.focus();
		}
	}

	// 從剪貼簿粘貼
	async function pasteFromClipboard() {
		try {
			const text = await navigator.clipboard.readText();
			if (text) {
				address = text.trim();
				if (inputElement) {
					inputElement.focus();
				}
			}
		} catch (err) {
			console.error('無法從剪貼簿粘貼:', err);
		}
	}

	function handleSubmit() {
		// 簡化地址驗證，只檢查是否有值
		if (!address || !address.trim()) {
			isValid = false;
			errorMessage = '請輸入錢包地址';
			return;
		}

		isValid = true;
		errorMessage = '';

		// 使用清理後的地址
		const trimmedAddress = address.trim();

		// 發送地址變更事件
		dispatch('addressChange', { address: trimmedAddress });

		// 如果在編輯模式，完成後退出編輯模式
		if (isEditing) {
			isEditing = false;
		}
	}

	// 顯示保存地址表單
	function showSaveAddressForm() {
		showSaveForm = true;
		// 如果有現有標籤，預先填入
		labelInput = currentLabel || '';
	}

	// 取消保存
	function cancelSave() {
		showSaveForm = false;
		labelInput = '';
	}

	// 保存地址
	function saveAddress() {
		if (!address || !address.trim()) {
			isValid = false;
			errorMessage = '請輸入錢包地址';
			return;
		}

		// 處理保存邏輯
		const addressToSave = address.trim();
		const label = labelInput.trim() || undefined;

		// 發送保存地址事件
		dispatch('saveAddress', {
			chain: currentChain,
			address: addressToSave,
			label
		});

		// 更新當前標籤
		currentLabel = label || '';

		// 清理表單
		showSaveForm = false;
		labelInput = '';
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSubmit();
		} else if (event.key === 'Escape') {
			cancelEditing();
		}
	}

	// 建議用戶查看已保存地址
	function suggestSavedAddresses() {
		// 發送事件，讓父元件可以處理這個事件
		dispatch('suggestSaved');
	}

	onMount(() => {
		loadAddressLabel();

		// 監聽保存地址事件，當有新地址保存時更新UI
		if (typeof window !== 'undefined') {
			window.addEventListener('addressesSaved', loadAddressLabel);
		}

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('addressesSaved', loadAddressLabel);
			}
		};
	});
</script>

<div class="address-input">
	{#if isEditing}
		<div class="relative">
			<div class="flex">
				<div class="relative flex-1">
					<input
						type="text"
						bind:value={address}
						placeholder="輸入錢包地址（0x...）"
						class="w-full rounded-xl border border-[#01cdfe]/30 bg-black/40 p-3 text-[#fffb96] focus:border-[#05ffa1] focus:outline-none"
						class:error={!isValid}
						on:keydown={handleKeyDown}
						bind:this={inputElement}
					/>
					{#if address}
						<button
							class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-[#ff71ce] hover:bg-[#ff71ce]/20"
							on:click={clearAddress}
							title="清空地址"
						>
							<X size={16} />
						</button>
					{/if}
				</div>
				<button
					class="ml-1 flex items-center justify-center rounded-lg bg-[#01cdfe]/20 p-3 text-[#01cdfe] transition-all hover:bg-[#01cdfe]/30"
					on:click={pasteFromClipboard}
					title="從剪貼簿粘貼"
				>
					<Clipboard size={18} />
				</button>
			</div>
			<div class="mt-2 flex justify-end gap-2">
				<button
					class="flex items-center justify-center rounded-lg bg-[#ff71ce]/20 px-3 py-2 text-sm text-[#ff71ce] transition-all hover:bg-[#ff71ce]/30"
					on:click={cancelEditing}
					title="取消"
				>
					<X size={16} class="mr-1" /> 取消
				</button>
				<button
					class="flex items-center justify-center rounded-lg bg-[#01cdfe]/20 px-3 py-2 text-sm text-[#01cdfe] transition-all hover:bg-[#01cdfe]/30"
					on:click={handleSubmit}
					title="確認"
				>
					<Check size={16} class="mr-1" /> 確認
				</button>
			</div>
		</div>
	{:else}
		<div class="address-preview-container group">
			<div
				class="address-display flex items-center gap-2 rounded-xl border border-[#01cdfe]/30 bg-black/40 p-3 transition-all hover:border-[#01cdfe]/60"
			>
				<span class="font-['MS_Gothic',monospace] text-[#fffb96]">
					{address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '請輸入地址'}
				</span>
				{#if currentLabel}
					<span class="label-tag">{currentLabel}</span>
				{/if}

				<div class="ml-auto flex gap-2 opacity-80 transition-opacity group-hover:opacity-100">
					<button
						class="icon-button text-[#05ffa1]"
						on:click={showSaveAddressForm}
						title="保存地址"
					>
						<Save size={16} />
					</button>
					<button class="icon-button text-[#01cdfe]" on:click={startEditing} title="編輯地址">
						<Edit size={16} />
					</button>
				</div>
			</div>

			{#if !currentLabel && hasSavedAddresses}
				<div
					class="saved-addresses-hint mt-1 text-center text-xs text-[#01cdfe]/70 hover:text-[#01cdfe]"
				>
					<button on:click={suggestSavedAddresses}> 從已保存地址中選擇 → </button>
				</div>
			{/if}
		</div>
	{/if}

	{#if !isValid && errorMessage}
		<p class="mt-2 text-sm text-[#ff71ce]">{errorMessage}</p>
	{/if}

	{#if showSaveForm}
		<div
			class="save-form-container mt-3 rounded-lg border border-[#05ffa1]/30 bg-black/50 p-3 backdrop-blur-sm"
		>
			<div class="mb-3">
				<input
					type="text"
					bind:value={labelInput}
					placeholder="輸入地址標籤（選填）"
					class="w-full rounded-lg border border-[#05ffa1]/30 bg-black/40 p-2 text-sm text-white placeholder-white/50 focus:border-[#05ffa1] focus:outline-none"
				/>
			</div>
			<div class="flex justify-end gap-2">
				<button
					class="flex items-center justify-center gap-1 rounded-lg border border-[#ff71ce]/30 bg-transparent px-3 py-1 text-sm text-[#ff71ce] transition-all hover:border-[#ff71ce]/50 hover:bg-[#ff71ce]/10"
					on:click={cancelSave}
				>
					<X size={14} /> 取消
				</button>
				<button
					class="flex items-center justify-center gap-1 rounded-lg bg-[#05ffa1]/20 px-3 py-1 text-sm text-[#05ffa1] transition-all hover:bg-[#05ffa1]/30"
					on:click={saveAddress}
				>
					<Save size={14} /> 保存
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.error {
		border-color: #ff71ce !important;
		box-shadow: 0 0 10px rgba(255, 113, 206, 0.4);
	}

	.address-preview-container {
		transition: all 0.3s ease;
	}

	.icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		padding: 0.25rem;
		border-radius: 0.375rem;
	}

	.icon-button:hover {
		transform: translateY(-1px);
		text-shadow: 0 0 8px currentColor;
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

	.save-form-container {
		animation: fadeIn 0.3s ease;
		box-shadow: 0 0 20px rgba(5, 255, 161, 0.1);
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
