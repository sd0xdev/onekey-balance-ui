<script lang="ts">
	import { chainsStore, type UserAddress } from '$lib/stores/chains';
	import { onMount } from 'svelte';

	let inputAddress = $chainsStore.currentAddress;
	let inputLabel = '';
	let isAddingAddress = false;
	let hasError = false;
	let errorMessage = '';

	// 驗證地址格式
	function validateAddress(address: string): boolean {
		// 簡單檢查地址格式，可按需調整為不同鏈的格式
		return /^0x[a-fA-F0-9]{40}$/.test(address);
	}

	// 添加或更新地址
	function handleSaveAddress() {
		if (!validateAddress(inputAddress)) {
			hasError = true;
			errorMessage = '無效的錢包地址格式';
			return;
		}

		const addressData: UserAddress = {
			chain: $chainsStore.selectedChain,
			address: inputAddress,
			label: inputLabel || undefined
		};

		chainsStore.updateAddress(addressData);
		chainsStore.setCurrentAddress(inputAddress);

		// 重置表單狀態
		hasError = false;
		errorMessage = '';
		isAddingAddress = false;
	}

	// 當選擇的鏈發生變化時，更新輸入框地址
	$: {
		if ($chainsStore.currentAddress !== inputAddress) {
			inputAddress = $chainsStore.currentAddress;

			// 獲取地址對應的標籤
			const addressInfo = $chainsStore.addresses.find(
				(a) => a.chain === $chainsStore.selectedChain && a.address === inputAddress
			);
			inputLabel = addressInfo?.label || '';
		}
	}

	// 切換地址輸入表單顯示
	function toggleAddressForm() {
		isAddingAddress = !isAddingAddress;
		if (!isAddingAddress) {
			// 重置錯誤狀態
			hasError = false;
			errorMessage = '';
		}
	}

	// 地址變更時重置錯誤狀態
	function handleAddressInput() {
		hasError = false;
		errorMessage = '';
	}
</script>

<div class="address-control mb-4">
	<div class="flex items-center justify-between">
		<div class="truncate font-['MS_Gothic',monospace] text-sm text-[#fffb96]">
			{#if isAddingAddress}
				輸入地址
			{:else}
				當前地址:
				<span class="font-bold">
					{inputAddress.slice(0, 6)}...{inputAddress.slice(-4)}
					{#if inputLabel}
						<span class="ml-1 text-xs text-white/70">({inputLabel})</span>
					{/if}
				</span>
			{/if}
		</div>
		<button
			on:click={toggleAddressForm}
			class="text-sm text-[#01cdfe] transition duration-300 hover:text-[#05ffa1]"
		>
			{isAddingAddress ? '取消' : '變更地址'}
		</button>
	</div>

	{#if isAddingAddress}
		<div class="mt-2 space-y-3">
			<div>
				<input
					type="text"
					bind:value={inputAddress}
					on:input={handleAddressInput}
					placeholder="輸入錢包地址 (0x...)"
					class="address-input w-full rounded-lg border border-white/30 bg-black/50 px-3 py-2 text-white placeholder-white/70 focus:border-[#01cdfe] focus:outline-none"
					class:error={hasError}
				/>
				{#if hasError}
					<p class="mt-1 text-xs text-[#ff71ce]">{errorMessage}</p>
				{/if}
			</div>

			<div>
				<input
					type="text"
					bind:value={inputLabel}
					placeholder="地址標籤 (選填)"
					class="address-input w-full rounded-lg border border-white/30 bg-black/50 px-3 py-2 text-white placeholder-white/70 focus:border-[#01cdfe] focus:outline-none"
				/>
			</div>

			<div class="flex justify-end">
				<button
					on:click={handleSaveAddress}
					class="hover:shadow-glow rounded-lg bg-gradient-to-r from-[#01cdfe] to-[#05ffa1] px-4 py-2 font-bold text-white transition duration-300 hover:bg-[size:150%_100%] hover:bg-[position:right_center]"
				>
					保存地址
				</button>
			</div>
		</div>
	{/if}
</div>
