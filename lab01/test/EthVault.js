import { expect } from 'chai'
import hre from 'hardhat'

describe('EthVault', function () {
	let ethers
	before(async function () {
		if (!hre.ethers) {
			const connection = await hre.network.connect('default')
			hre.ethers = connection.ethers
			ethers = connection.ethers
		} else {
			ethers = hre.ethers
		}
	})

	async function deployFixture() {
		const { ethers } = hre
		const [owner, alice, bob] = await ethers.getSigners()
		const EthVault = await ethers.getContractFactory('EthVault')
		const vault = await EthVault.deploy(owner.address)
		await vault.waitForDeployment()
		return { vault, owner, alice, bob }
	}

	async function transfer(from, vault, amount) {
		await expect(from.sendTransaction({ to: await vault.getAddress(), value: amount }))
			.to.emit(vault, 'Deposit')
			.withArgs(from.address, amount)
	}

	async function checkBalance(addr, amount) {
		expect(await ethers.provider.getBalance(addr)).to.equal(amount)
	}

	describe('A — Deposits', function () {
		it('single deposit increases balance and emits event', async function () {
			const { vault, alice } = await deployFixture()
			const amount = ethers.parseEther('1')

			await transfer(alice, vault, amount)

			await checkBalance(await vault.getAddress(), amount)
		})

		it('multiple deposits work (same sender)', async function () {
			const { vault, alice } = await deployFixture()
			const amount1 = ethers.parseEther('0.3')
			const amount2 = ethers.parseEther('0.7')

			await transfer(alice, vault, amount1)
			await transfer(alice, vault, amount2)

			await checkBalance(await vault.getAddress(), amount1 + amount2)
		})

		it('different senders deposit and events emitted', async function () {
			const { vault, alice, bob } = await deployFixture()
			const amount1 = ethers.parseEther('0.1')
			const amount2 = ethers.parseEther('0.2')

			await transfer(alice, vault, amount1)
			await transfer(bob, vault, amount2)

			await checkBalance(await vault.getAddress(), amount1 + amount2)
		})
	})

	describe('B — Owner Withdrawal', function () {
		it('owner can withdraw partial amount and emits event', async function () {
			const { vault, owner, alice } = await deployFixture()
			const amount = ethers.parseEther('1')
			const withdrawAmount = ethers.parseEther('0.4')

			await transfer(alice, vault, amount)

			await expect(vault.connect(owner).withdraw(withdrawAmount))
				.to.emit(vault, 'Withdraw')
				.withArgs(owner.address, withdrawAmount)

			await checkBalance(await vault.getAddress(), amount - withdrawAmount)
		})

		it('owner can withdraw full balance', async function () {
			const { vault, owner, alice } = await deployFixture()
			const amount = ethers.parseEther('1')

			await transfer(alice, vault, amount)

			await vault.connect(owner).withdraw(amount)
			await checkBalance(await vault.getAddress(), 0n)
		})
	})

	describe('C — Unauthorized Withdrawal', function () {
		it('non-owner withdraw does not revert, does not change balance, emits event', async function () {
			const { vault, alice, bob } = await deployFixture()
			const amount = ethers.parseEther('1')
			const attempt = ethers.parseEther('0.5')

			await transfer(alice, vault, amount)

			await expect(vault.connect(bob).withdraw(attempt))
				.to.emit(vault, 'UnauthorizedWithdrawAttempt')
				.withArgs(bob.address, attempt)

			await checkBalance(await vault.getAddress(), amount)
		})
	})

	describe('D — Edge Cases', function () {
		it('withdraw more than balance reverts (owner)', async function () {
			const { vault, owner, alice } = await deployFixture()
			const amount = ethers.parseEther('0.2')

			await transfer(alice, vault, amount)

			await expect(vault.connect(owner).withdraw(ethers.parseEther('1'))).to.be.revertedWith(
				'insufficient balance',
			)
		})

		it('withdraw zero (owner) succeeds and emits Withdraw with amount 0', async function () {
			const { vault, owner, alice } = await deployFixture()
			const amount = ethers.parseEther('0.2')

			await transfer(alice, vault, amount)

			await expect(vault.connect(owner).withdraw(0)).to.emit(vault, 'Withdraw').withArgs(owner.address, 0)

			await checkBalance(await vault.getAddress(), amount)
		})

		it('multiple deposits before withdrawal', async function () {
			const { vault, owner, alice, bob } = await deployFixture()
			const amount1 = ethers.parseEther('0.3')
			const amount2 = ethers.parseEther('0.4')

			await transfer(alice, vault, amount1)
			await transfer(bob, vault, amount2)

			const total = amount1 + amount2
			const withdrawAmount = ethers.parseEther('0.5')

			await vault.connect(owner).withdraw(withdrawAmount)
			await checkBalance(await vault.getAddress(), total - withdrawAmount)
		})
	})
})
