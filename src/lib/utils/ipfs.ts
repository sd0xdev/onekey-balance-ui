/**
 * 將 IPFS URL 轉換為可訪問的 HTTP URL
 * @param url 原始 URL
 * @returns 轉換後的 URL
 */
export function formatIPFSUrl(url: string): string {
	if (!url) return '';

	// 處理 IPFS 格式的 URL
	if (url.startsWith('ipfs://')) {
		// 移除 ipfs:// 前綴
		const ipfsHash = url.replace('ipfs://', '');

		// 使用可靠的 IPFS 網關 (可以根據需要調整網關)
		return `https://ipfs.io/ipfs/${ipfsHash}`;

		// 備用網關選項:
		// return `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
		// return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
		// return `https://dweb.link/ipfs/${ipfsHash}`;
	}

	// 如果不是 IPFS URL，則直接返回原始 URL
	return url;
}
