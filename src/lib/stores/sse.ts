import { writable } from 'svelte/store';
import { balanceStore } from './balance';
import { PUBLIC_API_URL } from '$env/static/public';

export type SSEStatus = 'CONNECTING' | 'ONLINE' | 'ERROR' | 'CLOSED' | 'OFFLINE';

export interface SSEStore {
	status: SSEStatus;
	retryCount: number;
	connection: EventSource | null;
	lastError: string;
	lastEventId: string;
	lastHeartbeat: number;
	nextRetryTime: number; // 新增：下次重試時間
}

// 擴展 EventSourceInit 類型以支持 headers
interface CustomEventSourceInit extends EventSourceInit {
	headers?: Record<string, string>;
}

const initialState: SSEStore = {
	status: 'CLOSED',
	retryCount: 0,
	connection: null,
	lastError: '',
	lastEventId: '',
	lastHeartbeat: 0,
	nextRetryTime: 0
};

// 最大重試次數
const MAX_RETRY_COUNT = 6;

function createSSEStore() {
	const { subscribe, set, update } = writable<SSEStore>(initialState);
	let retryTimeout: ReturnType<typeof setTimeout> | null = null;
	let heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null;
	let isRetrying = false; // 防止重複重試的標記

	// 計算指數避退重連時間 (最少 1 秒，最多 30 秒)
	const getRetryDelay = (retryCount: number) => {
		return Math.min(30000, Math.pow(2, retryCount) * 1000);
	};

	// 檢查心跳是否超時（超過 30 秒沒收到心跳就認為連接有問題）
	const startHeartbeatCheck = () => {
		if (heartbeatCheckInterval) {
			clearInterval(heartbeatCheckInterval);
		}

		heartbeatCheckInterval = setInterval(() => {
			const now = Date.now();
			update((state) => {
				// 如果超過 30 秒沒收到心跳且狀態是 ONLINE，則重新連接
				if (state.status === 'ONLINE' && now - state.lastHeartbeat > 30000) {
					console.warn('心跳超時，重新連接 SSE');
					if (state.connection) {
						state.connection.close();
					}

					// 安排重連
					if (retryTimeout) {
						clearTimeout(retryTimeout);
						retryTimeout = null;
					}

					const newRetryCount = state.retryCount + 1;
					if (newRetryCount > MAX_RETRY_COUNT) {
						console.warn('已達最大重試次數，停止重連');
						return {
							...state,
							status: 'OFFLINE',
							connection: null,
							lastError: '已達最大重試次數，停止重連'
						};
					}

					// 安排一次性重連
					if (!isRetrying) {
						isRetrying = true;
						retryTimeout = setTimeout(() => {
							isRetrying = false;
							retryTimeout = null;
							connect();
						}, 1000);
					}

					return {
						...state,
						status: 'ERROR',
						connection: null,
						retryCount: newRetryCount,
						lastError: '心跳超時，正在重新連接'
					};
				}
				return state;
			});
		}, 15000); // 每 15 秒檢查一次
	};

	// 停止心跳檢查
	const stopHeartbeatCheck = () => {
		if (heartbeatCheckInterval) {
			clearInterval(heartbeatCheckInterval);
			heartbeatCheckInterval = null;
		}
	};

	// 安排重試連接
	const scheduleRetry = (retryCount: number) => {
		// 如果已經在重試中，不再重複安排
		if (isRetrying) {
			return;
		}

		// 清除現有計時器
		if (retryTimeout) {
			clearTimeout(retryTimeout);
			retryTimeout = null;
		}

		// 檢查是否超過最大重試次數
		if (retryCount > MAX_RETRY_COUNT) {
			console.warn(`已達最大重試次數 (${MAX_RETRY_COUNT})，停止重連`);
			update((state) => ({
				...state,
				status: 'OFFLINE',
				connection: null,
				lastError: '已達最大重試次數，連接已離線'
			}));
			return;
		}

		// 計算延遲時間
		const delay = getRetryDelay(retryCount);
		const nextRetryTime = Date.now() + delay;

		console.log(
			`SSE 連接失敗，${delay / 1000} 秒後第 ${retryCount} 次重試 (${new Date(nextRetryTime).toLocaleTimeString()})`
		);

		// 更新下次重試時間
		update((state) => ({
			...state,
			nextRetryTime: nextRetryTime
		}));

		// 標記為正在重試
		isRetrying = true;

		// 設置新計時器
		retryTimeout = setTimeout(() => {
			console.log(`執行第 ${retryCount} 次重試 (${new Date().toLocaleTimeString()})`);
			isRetrying = false;
			retryTimeout = null;
			connect();
		}, delay);
	};

	// 建立 SSE 連接
	const connect = () => {
		// 檢查當前狀態
		let currentState: SSEStore = { ...initialState };
		subscribe((state) => {
			currentState = state;
		})();

		// 如果已經離線，除非手動調用 reconnect，否則不再自動嘗試連接
		if (currentState.status === 'OFFLINE') {
			console.log('SSE 已經在離線狀態，需要手動調用 reconnect 來重新連接');
			return;
		}

		// 如果已經在重試中，不要重複連接
		if (isRetrying) {
			console.log('已經在重試過程中，忽略這次連接請求');
			return;
		}

		// 防止重複調用 connect 時建立多個連接和多個重試計時器
		if (retryTimeout) {
			clearTimeout(retryTimeout);
			retryTimeout = null;
		}

		update((state) => {
			// 如果已經有連接，先關閉
			if (state.connection) {
				state.connection.close();
			}

			return {
				...state,
				status: 'CONNECTING',
				lastError: ''
			};
		});

		try {
			// 創建 SSE 連接時帶上 Last-Event-ID
			// 使用環境變數或默認值
			const baseUrl = PUBLIC_API_URL || '/api';
			console.log(`使用 SSE 連接基礎 URL: ${baseUrl}`);
			const url = new URL(`${baseUrl}/sse/subscribe/cache`, window.location.origin);
			const options: CustomEventSourceInit = {};

			// 如果有上次的事件 ID，添加到請求頭中
			if (currentState.lastEventId) {
				options.headers = {
					'Last-Event-ID': currentState.lastEventId
				};
			}

			const sse = new EventSource(url.toString(), options);

			// 立即標記此連接已經創建，防止在錯誤處理時重複觸發
			let connectionHandled = false;

			// 連接建立時
			sse.onopen = () => {
				// 標記該連接已處理，避免錯誤處理重複操作
				connectionHandled = true;

				update((state) => ({
					...state,
					status: 'ONLINE',
					retryCount: 0,
					connection: sse,
					lastError: '',
					lastHeartbeat: Date.now() // 初始化心跳時間
				}));

				// 啟動心跳檢查
				startHeartbeatCheck();
			};

			// 連接錯誤時 - 確保只處理一次
			sse.onerror = () => {
				// 如果連接已經被處理，不再重複處理
				if (connectionHandled) {
					// 先檢查當前狀態
					let currentState: SSEStore = { ...initialState };
					subscribe((state) => {
						currentState = state;
					})();

					// 只有在連接曾經成功但現在出錯的情況下進行處理
					// 這有助於避免初始連接失敗時的多次錯誤處理
					if (currentState.status === 'ONLINE' || currentState.status === 'ERROR') {
						handleConnectionError();
					}
				} else {
					// 標記連接已處理，避免後續重複操作
					connectionHandled = true;

					// 初始連接失敗，直接處理錯誤
					handleConnectionError();
				}
			};

			// 統一的錯誤處理函數
			const handleConnectionError = () => {
				// 先檢查當前狀態
				let currentState: SSEStore = { ...initialState };
				subscribe((state) => {
					currentState = state;
				})();

				// 如果已經是 OFFLINE 狀態，完全忽略所有後續錯誤
				if (currentState.status === 'OFFLINE') {
					return;
				}

				// 檢查是否在短時間內（500毫秒）已經處理過錯誤
				// 這有助於防止多次快速連續觸發同一個錯誤事件
				if (
					currentState.status === 'ERROR' &&
					Date.now() - currentState.nextRetryTime + getRetryDelay(currentState.retryCount) < 500
				) {
					return;
				}

				// 檢查連接是否已經關閉或處於錯誤狀態，避免多次處理
				let shouldRetry = false;

				update((state) => {
					// 如果已經處於錯誤狀態，不要重複處理同一個錯誤
					// 使用更寬鬆的時間檢查，避免頻繁更新狀態
					if (state.status === 'ERROR' && Date.now() < state.nextRetryTime - 1000) {
						return state;
					}

					// 關閉當前連接
					if (state.connection) {
						state.connection.close();
					}

					// 停止心跳檢查
					stopHeartbeatCheck();

					// 更新狀態並準備重連
					const newRetryCount = state.retryCount + 1;
					shouldRetry = newRetryCount <= MAX_RETRY_COUNT;

					return {
						...state,
						status: shouldRetry ? 'ERROR' : 'OFFLINE',
						retryCount: newRetryCount,
						connection: null,
						lastError: shouldRetry
							? `連接失敗，準備重試 (${newRetryCount}/${MAX_RETRY_COUNT})`
							: '已達最大重試次數，連接已離線'
					};
				});

				// 如果需要重試並且沒有正在進行的重試，則安排重試
				if (shouldRetry && !isRetrying) {
					let retryCount = 0;

					// 獲取當前重試次數
					subscribe((state) => {
						retryCount = state.retryCount;
					})();

					scheduleRetry(retryCount);
				}
			};

			// 處理消息
			sse.onmessage = (event) => {
				// 檢查是否是心跳消息
				if (event.data.startsWith(': keepalive')) {
					update((state) => ({
						...state,
						lastHeartbeat: Date.now()
					}));
					return;
				}

				// 更新最後收到的事件 ID
				if (event.lastEventId) {
					update((state) => ({
						...state,
						lastEventId: event.lastEventId
					}));
				}
			};

			// 監聽 cache.invalidate 事件
			sse.addEventListener('cache.invalidate', (event) => {
				try {
					const data = JSON.parse(event.data);
					// 檢查是否與當前用戶相關
					handleCacheInvalidation(data);

					// 更新最後收到的事件 ID
					if (event.lastEventId) {
						update((state) => ({
							...state,
							lastEventId: event.lastEventId
						}));
					}
				} catch (err) {
					console.error('解析 SSE 事件資料失敗', err);
				}
			});

			// 返回創建的連接
			return sse;
		} catch (err) {
			// 先檢查當前狀態
			let currentState: SSEStore = { ...initialState };
			subscribe((state) => {
				currentState = state;
			})();

			// 如果已經是 OFFLINE 狀態，不再處理任何錯誤
			if (currentState.status === 'OFFLINE') {
				return null;
			}

			// 處理連接建立過程中的錯誤
			let shouldRetry = false;

			update((state) => {
				const newRetryCount = state.retryCount + 1;
				shouldRetry = newRetryCount <= MAX_RETRY_COUNT;

				return {
					...state,
					status: shouldRetry ? 'ERROR' : 'OFFLINE',
					retryCount: newRetryCount,
					connection: null,
					lastError: err instanceof Error ? err.message : '連接失敗'
				};
			});

			// 如果需要重試且沒有正在進行的重試，則安排重試
			if (shouldRetry && !isRetrying) {
				let retryCount = 0;

				// 獲取當前重試次數
				subscribe((state) => {
					retryCount = state.retryCount;
				})();

				scheduleRetry(retryCount);
			}
			return null;
		}
	};

	// 處理 cache.invalidate 事件
	const handleCacheInvalidation = (data: {
		metadata?: { chain?: string; address?: string; chainId?: string };
	}) => {
		if (!data || !data.metadata) return;

		// 獲取 balanceStore 中的 chain 和 address
		let currentChain = '';
		let currentAddress = '';
		balanceStore.subscribe((state) => {
			currentChain = state.chain;
			currentAddress = state.address;
		})();

		const { metadata } = data;

		// 檢查是否與當前用戶相關
		if (
			metadata.chain &&
			metadata.address &&
			(currentChain === metadata.chain ||
				`${currentChain}_${metadata.chainId}` === metadata.chain) &&
			currentAddress.toLowerCase() === metadata.address.toLowerCase()
		) {
			// 刷新餘額
			console.log('檢測到與當前用戶相關的快取失效事件，刷新餘額數據');
			balanceStore.fetchBalance();
		}
	};

	// 關閉連接
	const disconnect = () => {
		isRetrying = false; // 重置重試標記

		update((state) => {
			if (state.connection) {
				state.connection.close();
			}

			if (retryTimeout) {
				clearTimeout(retryTimeout);
				retryTimeout = null;
			}

			stopHeartbeatCheck();

			return {
				...state,
				status: 'CLOSED',
				connection: null
			};
		});
	};

	// 強制重新連接 (重置重試計數)
	const reconnect = () => {
		isRetrying = false; // 重置重試標記
		disconnect();

		update((state) => ({
			...state,
			retryCount: 0,
			lastError: '',
			status: 'CONNECTING'
		}));

		// 刻意短暫延遲，確保斷開連接完成
		setTimeout(connect, 100);
	};

	return {
		subscribe,
		connect,
		disconnect,
		reconnect,
		reset: () => {
			disconnect();
			set(initialState);
		}
	};
}

export const sseStore = createSSEStore();
