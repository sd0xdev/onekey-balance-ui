<script lang="ts">
	import { chainsStore } from '$lib/stores/chains';
	import { Trash2 } from '@lucide/svelte';

	// 確認刪除地址
	let addressToDelete: { chain: string; address: string } | null = null;
	let showDeleteConfirm = false;

	// 顯示刪除確認對話框
	function confirmDelete(chain: string, address: string) {
		addressToDelete = { chain, address };
		showDeleteConfirm = true;
	}

	// 刪除地址
	function deleteAddress() {
		if (addressToDelete) {
			chainsStore.removeAddress(addressToDelete.chain, addressToDelete.address);
			showDeleteConfirm = false;
			addressToDelete = null;
		}
	}

	// 取消刪除
	function cancelDelete() {
		showDeleteConfirm = false;
		addressToDelete = null;
	}

	// 選擇地址
	function selectAddress(address: string) {
		chainsStore.setCurrentAddress(address);
	}

	// 過濾當前鏈上的地址
	$: addressesForCurrentChain = $chainsStore.addresses.filter(
		(a) => a.chain === $chainsStore.selectedChain
	);
</script>

<div class="saved-addresses mb-6">
	<h3 class="mb-2 font-['Bodoni_Moda',serif] text-lg text-[#01cdfe]">已保存地址</h3>

	{#if addressesForCurrentChain.length === 0}
		<p class="text-sm text-white/60">尚未為此鏈保存任何地址</p>
	{:else}
		<div class="space-y-2">
			{#each addressesForCurrentChain as address}
				<div
					class="address-item flex items-center justify-between rounded-lg border border-white/20 bg-black/70 p-3 transition-all hover:border-[#05ffa1]"
					class:selected={address.address === $chainsStore.currentAddress}
				>
					<button class="flex-1 text-left" on:click={() => selectAddress(address.address)}>
						<div class="flex items-baseline gap-2">
							<span class="font-['MS_Gothic',monospace] text-[#fffb96]">
								{address.address.slice(0, 8)}...{address.address.slice(-6)}
							</span>
							{#if address.label}
								<span class="address-label text-sm text-white">{address.label}</span>
							{/if}
						</div>
					</button>
					<button
						class="delete-btn ml-2 p-1 hover:text-[#ff71ce]"
						on:click={() => confirmDelete(address.chain, address.address)}
						aria-label="刪除地址"
					>
						<Trash2 size={16} color="#FFFFFF" opacity={0.5} />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	{#if showDeleteConfirm}
		<div
			class="delete-confirm-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70"
		>
			<div
				class="confirm-dialog max-w-sm rounded-xl border border-white/20 bg-black/90 p-5 backdrop-blur-lg"
			>
				<h4 class="mb-4 text-xl text-[#ff71ce]">確認刪除</h4>
				<p class="mb-6 text-white">
					確定要刪除地址
					<span class="font-['MS_Gothic',monospace] text-[#fffb96]">
						{addressToDelete?.address.slice(0, 8)}...{addressToDelete?.address.slice(-6)}
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
						class="rounded-lg bg-gradient-to-r from-[#ff71ce] to-[#ff5252] px-4 py-2 font-bold text-white transition duration-300 hover:shadow-[0_0_15px_rgba(255,113,206,0.5)]"
						on:click={deleteAddress}
					>
						刪除
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
