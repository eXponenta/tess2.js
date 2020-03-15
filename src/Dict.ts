
export class DictNode {
	key: any = null;
	next: DictNode = null;
	prev: DictNode = null;
}

export class Dict {
	head: DictNode = new DictNode();
	
	constructor(public frame: any, public leq: (...arg: any) => boolean) {
		this.head.next = this.head;
		this.head.prev = this.head;
	}

	min() {
		return this.head.next;
	}

	max() {
		return this.head.prev;
	}

	insert(k: any) {
		return this.insertBefore(this.head, k);
	}

	search(key: any) {
		/* Search returns the node with the smallest key greater than or equal
		 * to the given key.  If there is no such key, returns a node whose
		 * key is NULL.  Similarly, Succ(Max(d)) has a NULL key, etc.
		 */
		let node = this.head;
		do {
			node = node.next;
		} while (node.key !== null && !this.leq(this.frame, key, node.key));

		return node;
	}

	insertBefore(node: DictNode, key: any) {
		do {
			node = node.prev;
		} while (node.key !== null && !this.leq(this.frame, node.key, key));

		const newNode = new DictNode();
		newNode.key = key;
		newNode.next = node.next;
		node.next.prev = newNode;
		newNode.prev = node;
		node.next = newNode;

		return newNode;
	}

	delete(node:DictNode) {
		node.next.prev = node.prev;
		node.prev.next = node.next;
	}
};