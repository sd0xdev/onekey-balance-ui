<script lang="ts">
	import { onMount, afterUpdate, tick, createEventDispatcher } from 'svelte';
	import { chainsStore } from '$lib/stores/chains';
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	const dispatch = createEventDispatcher();

	// 獲取鏈的圖標
	function getIconForChain(chainType: string): string {
		const icons: Record<string, string> = {
			ethereum: '⟠',
			bitcoin: '₿',
			solana: '◎',
			polygon: '⬡',
			bsc: '🔶',
			arbitrum: '🔵',
			optimism: '🔴',
			avalanche: '🔺'
		};

		return icons[chainType.toLowerCase()] || '🪙';
	}

	// 控制下拉框顯示
	let isDropdownOpen = false;
	let selectorButton: HTMLButtonElement;
	let dropdownContainer: HTMLDivElement;
	let dropdownList: HTMLDivElement;
	let activeIndex = -1;
	let buttonRect: DOMRect | null = null;
	let portalContainer: HTMLDivElement | null = null;

	// 監聽按鍵
	function handleKeydown(event: KeyboardEvent) {
		if (
			(!isDropdownOpen && event.key === 'Enter') ||
			event.key === ' ' ||
			event.key === 'ArrowDown'
		) {
			event.preventDefault();
			openDropdown();
			return;
		}

		if (!isDropdownOpen) return;

		const chains = $chainsStore.chains;

		switch (event.key) {
			case 'Escape':
				event.preventDefault();
				closeDropdown();
				break;
			case 'ArrowDown':
				event.preventDefault();
				if (activeIndex < chains.length - 1) {
					activeIndex++;
					scrollActiveIntoView();
				}
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (activeIndex > 0) {
					activeIndex--;
					scrollActiveIntoView();
				}
				break;
			case 'Home':
				event.preventDefault();
				if (chains.length > 0) {
					activeIndex = 0;
					scrollActiveIntoView();
				}
				break;
			case 'End':
				event.preventDefault();
				if (chains.length > 0) {
					activeIndex = chains.length - 1;
					scrollActiveIntoView();
				}
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				if (activeIndex >= 0 && activeIndex < chains.length) {
					handleSelectChain(chains[activeIndex].type);
				}
				break;
			default:
				// 實現首字母跳轉
				const key = event.key.toLowerCase();
				if (key.length === 1 && /[a-z0-9]/.test(key)) {
					const index = chains.findIndex((chain) => chain.name.toLowerCase().startsWith(key));
					if (index !== -1) {
						activeIndex = index;
						scrollActiveIntoView();
					}
				}
				break;
		}
	}

	function scrollActiveIntoView() {
		if (!dropdownList) return;

		const activeEl = dropdownList.querySelector(
			`.chain-option[data-index="${activeIndex}"]`
		) as HTMLElement;
		if (activeEl) {
			activeEl.scrollIntoView({ block: 'nearest' });
		}
	}

	// 選擇鏈
	function handleSelectChain(chainId: string) {
		chainsStore.selectChain(chainId);
		closeDropdown();
		selectorButton?.focus();
	}

	// 創建並渲染下拉選單到 body
	function createDropdownPortal() {
		if (!document) return;

		// 移除任何存在的 portal
		removeDropdownPortal();

		// 創建新的 portal 容器
		portalContainer = document.createElement('div');
		portalContainer.id = 'chain-dropdown-portal';
		portalContainer.style.position = 'fixed';
		portalContainer.style.zIndex = '9999';
		portalContainer.style.overflow = 'visible';

		if (buttonRect) {
			portalContainer.style.top = `${buttonRect.bottom + window.scrollY}px`;
			portalContainer.style.left = `${buttonRect.left + window.scrollX}px`;
			portalContainer.style.width = `${Math.max(buttonRect.width * 1.5, 280)}px`;
		}

		document.body.appendChild(portalContainer);

		// 創建下拉選單內容
		const dropdownContent = document.createElement('div');
		dropdownContent.className = 'chain-dropdown-content';
		portalContainer.appendChild(dropdownContent);

		// 在這裡手動渲染下拉選單
		renderDropdownContent(dropdownContent);
	}

	// 移除下拉選單 portal
	function removeDropdownPortal() {
		const existingPortal = document.getElementById('chain-dropdown-portal');
		if (existingPortal) {
			document.body.removeChild(existingPortal);
		}
		portalContainer = null;
	}

	// 手動渲染下拉選單內容
	function renderDropdownContent(container: HTMLElement) {
		// 創建下拉選單容器
		const dropdown = document.createElement('div');
		dropdown.id = 'chain-options-portal';
		dropdown.className = 'chain-dropdown';
		dropdown.setAttribute('role', 'listbox');
		dropdown.setAttribute('tabindex', '-1');
		dropdown.setAttribute('aria-label', '區塊鏈選擇器');

		if (activeIndex >= 0) {
			dropdown.setAttribute('aria-activedescendant', `chain-option-${activeIndex}`);
		}

		container.appendChild(dropdown);
		dropdownList = dropdown;

		// 根據加載狀態顯示不同內容
		if ($chainsStore.isLoading) {
			const loadingDiv = document.createElement('div');
			loadingDiv.className = 'p-4 text-center text-sm text-[#fffb96]';
			loadingDiv.textContent = '載入中...';
			dropdown.appendChild(loadingDiv);
		} else if ($chainsStore.error) {
			const errorDiv = document.createElement('div');
			errorDiv.className = 'p-4 text-center text-sm text-[#ff71ce]';
			errorDiv.textContent = `載入失敗: ${$chainsStore.error}`;
			dropdown.appendChild(errorDiv);
		} else {
			const innerDiv = document.createElement('div');
			innerDiv.className = 'dropdown-inner';
			dropdown.appendChild(innerDiv);

			// 創建選項
			$chainsStore.chains.forEach((chain, index) => {
				const option = document.createElement('div');
				option.id = `chain-option-${index}`;
				option.className =
					'chain-option relative flex w-full items-center gap-4 px-5 py-4 text-left transition-all';
				option.setAttribute('data-index', index.toString());
				option.setAttribute('role', 'option');
				option.setAttribute('data-testnet', chain.isTestnet ? 'true' : 'false');
				option.setAttribute(
					'aria-selected',
					($chainsStore.selectedChain === chain.type).toString()
				);

				if ($chainsStore.selectedChain === chain.type) {
					option.classList.add('selected');
				}

				if (activeIndex === index) {
					option.classList.add('active');
				}

				// 添加圖標
				const iconSpan = document.createElement('span');
				iconSpan.className = 'chain-icon-small';
				iconSpan.setAttribute('aria-hidden', 'true');
				iconSpan.textContent = getIconForChain(chain.type);
				option.appendChild(iconSpan);

				// 添加名稱
				const nameSpan = document.createElement('span');
				nameSpan.className = 'font-normal';
				nameSpan.textContent = chain.name;
				option.appendChild(nameSpan);

				// 如果是測試網，添加標籤
				if (chain.isTestnet) {
					const testnetSpan = document.createElement('span');
					testnetSpan.className =
						'ml-auto rounded-full bg-yellow-500/30 px-3 py-1 text-xs font-medium text-yellow-300';
					testnetSpan.textContent = '測試網';
					testnetSpan.style.display = 'inline-block';
					testnetSpan.style.whiteSpace = 'nowrap';
					testnetSpan.style.zIndex = '5';
					option.appendChild(testnetSpan);
				}

				// 添加事件監聽器
				option.addEventListener('click', () => handleSelectChain(chain.type));
				option.addEventListener('mouseenter', () => {
					activeIndex = index;

					// 更新活動選項樣式
					document.querySelectorAll('.chain-option').forEach((el, idx) => {
						if (idx === index) {
							el.classList.add('active');
						} else {
							el.classList.remove('active');
						}
					});
				});

				innerDiv.appendChild(option);
			});
		}

		// 加入動畫效果
		dropdown.style.opacity = '0';
		setTimeout(() => {
			dropdown.style.opacity = '1';
			dropdown.style.transition = 'opacity 150ms';
		}, 10);
	}

	// 打開下拉選單
	async function openDropdown() {
		isDropdownOpen = true;
		activeIndex = $chainsStore.chains.findIndex((c) => c.type === $chainsStore.selectedChain);
		await tick(); // 等待DOM更新
		if (selectorButton) {
			buttonRect = selectorButton.getBoundingClientRect();
			createDropdownPortal();
		}
	}

	// 關閉下拉選單
	function closeDropdown() {
		isDropdownOpen = false;
		activeIndex = -1;
		removeDropdownPortal();
	}

	// 切換下拉選單
	function toggleDropdown(event: MouseEvent) {
		event.stopPropagation(); // 阻止事件冒泡

		if (isDropdownOpen) {
			closeDropdown();
		} else {
			openDropdown();
		}
	}

	// 點擊事件處理
	function handleDocumentClick(event: MouseEvent) {
		// 如果點擊位置不在選擇器內，關閉下拉選單
		if (isDropdownOpen) {
			const target = event.target as Node;
			const dropdownEl = document.getElementById('chain-dropdown-portal');
			if (dropdownEl && !dropdownEl.contains(target) && !dropdownContainer.contains(target)) {
				closeDropdown();
			}
		}
	}

	// 懸停處理
	function handleMouseEnter(index: number) {
		activeIndex = index;
	}

	onMount(() => {
		// 獲取區塊鏈列表，包含測試網
		chainsStore
			.fetchChains(true)
			.catch((err) => {
				console.error('獲取區塊鏈列表失敗:', err);
			})
			.then(() => {
				console.log('已載入的鏈列表:', $chainsStore.chains);
				console.log('測試網數量:', $chainsStore.chains.filter((c) => c.isTestnet).length);
			});

		// 全局事件監聽
		document.addEventListener('click', handleDocumentClick);

		return () => {
			document.removeEventListener('click', handleDocumentClick);
			// 確保清理任何可能存在的 portal
			removeDropdownPortal();
		};
	});
</script>

<div class="chain-selector" bind:this={dropdownContainer}>
	<!-- 下拉選擇按鈕 -->
	<button
		bind:this={selectorButton}
		on:click={toggleDropdown}
		on:keydown={handleKeydown}
		class="chain-button flex items-center justify-between gap-3 rounded-full border border-[#fffb96]/60 bg-[#0a0c15]/90 px-4 py-2 transition-all hover:border-[#fffb96] hover:shadow-[0_0_15px_rgba(255,251,150,0.3)]"
		aria-haspopup="listbox"
		aria-expanded={isDropdownOpen}
		aria-controls={isDropdownOpen ? 'chain-options-portal' : undefined}
	>
		<div class="flex items-center gap-2">
			<span class="chain-icon" aria-hidden="true"
				>{getIconForChain($chainsStore.selectedChain)}</span
			>
			<span class="chain-name">
				{$chainsStore.chains.find((c) => c.type === $chainsStore.selectedChain)?.name ||
					$chainsStore.selectedChain}
			</span>
		</div>
		<span class="dropdown-arrow text-xs" class:open={isDropdownOpen} aria-hidden="true">▼</span>
	</button>
</div>

<style>
	/* 確保下拉選單的樣式在 portal 中也生效 */
	:global(#chain-dropdown-portal .chain-dropdown) {
		background-color: #0f172a;
		border-radius: 0.5rem;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
		max-height: 320px;
		overflow-y: auto;
		border: 1px solid rgba(255, 251, 150, 0.2);
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 251, 150, 0.3) transparent;
	}

	:global(#chain-dropdown-portal .dropdown-inner) {
		padding: 0.5rem 0;
	}

	:global(#chain-dropdown-portal::-webkit-scrollbar) {
		display: none;
	}

	:global(#chain-dropdown-portal .chain-dropdown::-webkit-scrollbar) {
		width: 8px;
	}

	:global(#chain-dropdown-portal .chain-dropdown::-webkit-scrollbar-track) {
		background: transparent;
	}

	:global(#chain-dropdown-portal .chain-dropdown::-webkit-scrollbar-thumb) {
		background-color: rgba(255, 251, 150, 0.3);
		border-radius: 4px;
	}

	:global(#chain-dropdown-portal .chain-option) {
		cursor: pointer;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	:global(#chain-dropdown-portal .chain-option:last-child) {
		border-bottom: none;
	}

	:global(#chain-dropdown-portal .chain-option[data-testnet='true']) {
		background-color: rgba(0, 0, 0, 0.3);
	}

	:global(#chain-dropdown-portal .chain-option:hover),
	:global(#chain-dropdown-portal .chain-option.active) {
		background-color: rgba(255, 251, 150, 0.1);
	}

	:global(#chain-dropdown-portal .chain-option.selected) {
		background-color: rgba(255, 251, 150, 0.2);
	}

	/* 下拉箭頭旋轉動畫 */
	.dropdown-arrow {
		transition: transform 0.2s ease;
	}

	.dropdown-arrow.open {
		transform: rotate(180deg);
	}
</style>
