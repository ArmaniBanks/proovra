// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/SettlementEscrow.sol";

interface Vm {
    function envUint(string calldata name) external view returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeploySettlementEscrow {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (SettlementEscrow escrow) {
        uint256 deployerPrivateKey = vm.envUint("ARC_TESTNET_DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        escrow = new SettlementEscrow();
        vm.stopBroadcast();
    }
}
