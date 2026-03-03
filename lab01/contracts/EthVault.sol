// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract EthVault {
	event Deposit(address indexed sender, uint256 amount);

	event Withdraw(address indexed to, uint256 amount);

	event UnauthorizedWithdrawAttempt(address indexed caller, uint256 amount);

	address public immutable owner;

	constructor(address _owner) {
		require(_owner != address(0), 'owner=0');
		owner = _owner;
	}

	receive() external payable {
		emit Deposit(msg.sender, msg.value);
	}

	function withdraw(uint256 amount) external {
		if (msg.sender != owner) {
			emit UnauthorizedWithdrawAttempt(msg.sender, amount);
			return; // must NOT revert for non-owner
		}

		require(amount <= address(this).balance, 'insufficient balance');

		(bool ok, ) = owner.call{value: amount}('');
		require(ok, 'transfer failed');

		emit Withdraw(owner, amount);
	}
}
