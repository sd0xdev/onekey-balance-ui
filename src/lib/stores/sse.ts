import { writable } from 'svelte/store';
import { balanceStore } from './balance';

export type SSEStatus = 'CONNECTING' | 'ONLINE' | 'ERROR' | 'CLOSED';

export interface SSEStore {
	status: SSEStatus;
	retryCount: number;
	connection: EventSource | null;
	lastError: string;
	lastEventId: string;
	lastHeartbeat: number;
}

const initialState: SSEStore = {
	status: 'CLOSED',
	retryCount: 0,
	connection: null,
	lastError: '',
	lastEventId: '',
	lastHeartbeat: 0
};

function createSSEStore() {
	const { subscribe, set, update } = writable<SSEStore>(initialState);
	let retryTimeout: ReturnType<typeof setTimeout> | null = null;
	let heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null;

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
					}
					retryTimeout = setTimeout(connect, 1000);

					return {
						...state,
						status: 'ERROR',
						connection: null,
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

	// 建立 SSE 連接
	const connect = () => {
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

		let currentState: SSEStore;
		subscribe((state) => {
			currentState = state;
		})();

		try {
			// 創建 SSE 連接時帶上 Last-Event-ID
			const url = new URL('http://localhost:3000/v1/api/sse/subscribe/cache');
			const options: EventSourceInit = {};

			// 如果有上次的事件 ID，添加到請求頭中
			if (currentState.lastEventId) {
				options.headers = {
					'Last-Event-ID': currentState.lastEventId
				};
			}

			const sse = new EventSource(url.toString(), options);

			// 連接建立時
			sse.onopen = () => {
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

			// 連接錯誤時
			sse.onerror = (error) => {
				update((state) => {
					// 關閉當前連接
					if (state.connection) {
						state.connection.close();
					}

					// 停止心跳檢查
					stopHeartbeatCheck();

					// 更新狀態並準備重連
					const newRetryCount = state.retryCount + 1;
					const delay = getRetryDelay(newRetryCount);

					if (retryTimeout) {
						clearTimeout(retryTimeout);
					}

					retryTimeout = setTimeout(connect, delay);

					return {
						...state,
						status: 'ERROR',
						retryCount: newRetryCount,
						connection: null,
						lastError: `連接失敗，${delay / 1000} 秒後重試`
					};
				});
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
			// 處理連接建立過程中的錯誤
			update((state) => {
				const newRetryCount = state.retryCount + 1;
				const delay = getRetryDelay(newRetryCount);

				if (retryTimeout) {
					clearTimeout(retryTimeout);
				}

				retryTimeout = setTimeout(connect, delay);

				return {
					...state,
					status: 'ERROR',
					retryCount: newRetryCount,
					connection: null,
					lastError: err instanceof Error ? err.message : '連接失敗'
				};
			});
			return null;
		}
	};

	// 處理 cache.invalidate 事件
	const handleCacheInvalidation = (data: any) => {
		if (!data || !data.metadata) return;

		// 獲取 balanceStore 中的 chain 和 address
		let currentChain: string;
		let currentAddress: string;
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

	return {
		subscribe,
		connect,
		disconnect,
		reset: () => {
			disconnect();
			set(initialState);
		}
	};
}

export const sseStore = createSSEStore();
