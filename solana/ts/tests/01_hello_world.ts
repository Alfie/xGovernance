import { expect } from "chai";
import * as web3 from "@solana/web3.js";
import {
  deriveAddress,
  getPostMessageCpiAccounts,
  NodeWallet,
  postVaaSolana,
} from "@certusone/wormhole-sdk/lib/cjs/solana";
import {
  getPostedMessage,
  getProgramSequenceTracker,
  getWormholeDerivedAccounts,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";
import {
  MockEmitter,
  MockGuardians,
} from "@certusone/wormhole-sdk/lib/cjs/mock";
import { parseVaa } from "@certusone/wormhole-sdk";
import {
  createHelloWorldProgramInterface,
  createInitializeInstruction,
  createReceiveMessageInstruction,
  createRegisterForeignEmitterInstruction,
  createSendMessageInstruction,
  deriveConfigKey,
  deriveForeignEmitterKey,
  deriveWormholeMessageKey,
  getConfigData,
  getForeignEmitterData,
  getReceivedData,
} from "../sdk/01_hello_world";
import {
  FUZZ_TEST_ITERATIONS,
  GUARDIAN_PRIVATE_KEY,
  HELLO_WORLD_ADDRESS,
  LOCALHOST,
  PAYER_PRIVATE_KEY,
  WORMHOLE_ADDRESS,
} from "./helpers/consts";
import { errorExistsInLog } from "./helpers/error";

describe(" 1: Hello World", () => {
  const connection = new web3.Connection(LOCALHOST, "confirmed");
  const payer = web3.Keypair.fromSecretKey(PAYER_PRIVATE_KEY);

  // foreign emitter info
  const foreignEmitterChain = 2;
  const foreignEmitterAddress = Buffer.alloc(32, "deadbeef", "hex");

  // Create real pdas and array of invalid ones (generated from other bumps).
  // This is a bit hardcore, but should show the effectiveness of using Anchor
  const wormholeCpi = getWormholeDerivedAccounts(
    HELLO_WORLD_ADDRESS,
    WORMHOLE_ADDRESS
  );

  const realConfig = deriveConfigKey(HELLO_WORLD_ADDRESS);
  const realForeignEmitter = deriveForeignEmitterKey(
    HELLO_WORLD_ADDRESS,
    foreignEmitterChain
  );

  describe("Initialize Program", () => {
    describe("Fuzz Test Invalid Accounts for Instruction: initialize", () => {
      // program interface
      const program = createHelloWorldProgramInterface(
        connection,
        HELLO_WORLD_ADDRESS
      );

      const wormholeCpi = getPostMessageCpiAccounts(
        HELLO_WORLD_ADDRESS,
        WORMHOLE_ADDRESS,
        payer.publicKey,
        deriveAddress([Buffer.from("alive")], HELLO_WORLD_ADDRESS)
      );

      it("Invalid Account: config", async () => {
        const possibleConfigs: web3.PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleConfigs.push(
              web3.PublicKey.createProgramAddressSync(
                [Buffer.from("config"), bumpBytes],
                HELLO_WORLD_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(possibleConfigs.shift()!.equals(realConfig)).is.true;

        for (const config of possibleConfigs) {
          const initializeTx = await program.methods
            .initialize()
            .accounts({
              owner: payer.publicKey,
              config,
              wormholeProgram: WORMHOLE_ADDRESS,
              wormholeBridge: wormholeCpi.wormholeBridge,
              wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
              wormholeEmitter: wormholeCpi.wormholeEmitter,
              wormholeSequence: wormholeCpi.wormholeSequence,
              wormholeMessage: wormholeCpi.wormholeMessage,
              clock: wormholeCpi.clock,
              rent: wormholeCpi.rent,
            })
            .instruction()
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "Cross-program invocation with unauthorized signer or writable account"
                )
              ).is.true;
              return null;
            });
          expect(initializeTx).is.null;
        }
      });

      it("Invalid Account: wormhole_program", async () => {
        const wormholeProgram = web3.Ed25519Program.programId;

        const initializeTx = await program.methods
          .initialize()
          .accounts({
            owner: payer.publicKey,
            config: realConfig,
            wormholeProgram,
            wormholeBridge: wormholeCpi.wormholeBridge,
            wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
            wormholeEmitter: wormholeCpi.wormholeEmitter,
            wormholeSequence: wormholeCpi.wormholeSequence,
            wormholeMessage: wormholeCpi.wormholeMessage,
            clock: wormholeCpi.clock,
            rent: wormholeCpi.rent,
          })
          .instruction()
          .then((ix) =>
            web3.sendAndConfirmTransaction(
              connection,
              new web3.Transaction().add(ix),
              [payer]
            )
          )
          .catch((reason) => {
            expect(errorExistsInLog(reason, "InvalidProgramId")).to.be.true;
            return null;
          });
        expect(initializeTx).is.null;
      });

      it("Invalid Account: wormhole_bridge", async () => {
        const possibleWormholeBridges: web3.PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleWormholeBridges.push(
              web3.PublicKey.createProgramAddressSync(
                [Buffer.from("Bridge"), bumpBytes],
                WORMHOLE_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(
          possibleWormholeBridges.shift()!.equals(wormholeCpi.wormholeBridge)
        ).is.true;

        for (const wormholeBridge of possibleWormholeBridges) {
          const initializeTx = await program.methods
            .initialize()
            .accounts({
              owner: payer.publicKey,
              config: realConfig,
              wormholeProgram: WORMHOLE_ADDRESS,
              wormholeBridge,
              wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
              wormholeEmitter: wormholeCpi.wormholeEmitter,
              wormholeSequence: wormholeCpi.wormholeSequence,
              wormholeMessage: wormholeCpi.wormholeMessage,
              clock: wormholeCpi.clock,
              rent: wormholeCpi.rent,
            })
            .instruction()
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              expect(errorExistsInLog(reason, "AccountNotInitialized")).is.true;
              return null;
            });
          expect(initializeTx).is.null;
        }
      });

      it("Invalid Account: wormhole_fee_collector", async () => {
        const possibleWormholeFeeCollectors: web3.PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleWormholeFeeCollectors.push(
              web3.PublicKey.createProgramAddressSync(
                [Buffer.from("fee_collector"), bumpBytes],
                WORMHOLE_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(
          possibleWormholeFeeCollectors
            .shift()!
            .equals(wormholeCpi.wormholeFeeCollector)
        ).is.true;

        for (const wormholeFeeCollector of possibleWormholeFeeCollectors) {
          const initializeTx = await program.methods
            .initialize()
            .accounts({
              owner: payer.publicKey,
              config: realConfig,
              wormholeProgram: WORMHOLE_ADDRESS,
              wormholeBridge: wormholeCpi.wormholeBridge,
              wormholeFeeCollector,
              wormholeEmitter: wormholeCpi.wormholeEmitter,
              wormholeSequence: wormholeCpi.wormholeSequence,
              wormholeMessage: wormholeCpi.wormholeMessage,
              clock: wormholeCpi.clock,
              rent: wormholeCpi.rent,
            })
            .instruction()
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              expect(errorExistsInLog(reason, "AccountNotInitialized")).is.true;
              return null;
            });
          expect(initializeTx).is.null;
        }
      });

      it("Invalid Account: wormhole_emitter", async () => {
        const possibleWormholeEmitters: web3.PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleWormholeEmitters.push(
              web3.PublicKey.createProgramAddressSync(
                [Buffer.from("emitter"), bumpBytes],
                HELLO_WORLD_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(
          possibleWormholeEmitters.shift()!.equals(wormholeCpi.wormholeEmitter)
        ).is.true;

        for (const wormholeEmitter of possibleWormholeEmitters) {
          const initializeTx = await program.methods
            .initialize()
            .accounts({
              owner: payer.publicKey,
              config: realConfig,
              wormholeProgram: WORMHOLE_ADDRESS,
              wormholeBridge: wormholeCpi.wormholeBridge,
              wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
              wormholeEmitter,
              wormholeSequence: wormholeCpi.wormholeSequence,
              wormholeMessage: wormholeCpi.wormholeMessage,
              clock: wormholeCpi.clock,
              rent: wormholeCpi.rent,
            })
            .instruction()
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "Cross-program invocation with unauthorized signer or writable account"
                )
              ).is.true;
              return null;
            });
          expect(initializeTx).is.null;
        }
      });

      it("Invalid Account: wormhole_sequence", async () => {
        const possibleWormholeSequences: web3.PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleWormholeSequences.push(
              web3.PublicKey.createProgramAddressSync(
                [
                  Buffer.from("Sequence"),
                  wormholeCpi.wormholeEmitter.toBuffer(),
                  bumpBytes,
                ],
                WORMHOLE_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(
          possibleWormholeSequences
            .shift()!
            .equals(wormholeCpi.wormholeSequence)
        ).is.true;

        for (const wormholeSequence of possibleWormholeSequences) {
          const initializeTx = await program.methods
            .initialize()
            .accounts({
              owner: payer.publicKey,
              config: realConfig,
              wormholeProgram: WORMHOLE_ADDRESS,
              wormholeBridge: wormholeCpi.wormholeBridge,
              wormholeFeeCollector: wormholeCpi.wormholeFeeCollector,
              wormholeEmitter: wormholeCpi.wormholeSequence,
              wormholeSequence,
              wormholeMessage: wormholeCpi.wormholeMessage,
              clock: wormholeCpi.clock,
              rent: wormholeCpi.rent,
            })
            .instruction()
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "Cross-program invocation with unauthorized signer or writable account"
                )
              ).is.true;
              return null;
            });
          expect(initializeTx).is.null;
        }
      });
    });

    describe("Finally Set Up Program", () => {
      it("Instruction: initialize", async () => {
        const initializeTx = await createInitializeInstruction(
          connection,
          HELLO_WORLD_ADDRESS,
          payer.publicKey,
          WORMHOLE_ADDRESS
        )
          .then((ix) =>
            web3.sendAndConfirmTransaction(
              connection,
              new web3.Transaction().add(ix),
              [payer]
            )
          )
          .catch((reason) => {
            // should not happen
            console.log(reason);
            return null;
          });
        expect(initializeTx).is.not.null;

        // verify account data
        const configData = await getConfigData(connection, HELLO_WORLD_ADDRESS);
        expect(configData.owner.equals(payer.publicKey)).is.true;

        const wormholeCpi = getWormholeDerivedAccounts(
          HELLO_WORLD_ADDRESS,
          WORMHOLE_ADDRESS
        );
        expect(configData.wormhole.bridge.equals(wormholeCpi.wormholeBridge)).to
          .be.true;
        expect(
          configData.wormhole.feeCollector.equals(
            wormholeCpi.wormholeFeeCollector
          )
        ).is.true;
      });

      it("Cannot Call Instruction Again: initialize", async () => {
        const initializeTx = await createInitializeInstruction(
          connection,
          HELLO_WORLD_ADDRESS,
          payer.publicKey,
          WORMHOLE_ADDRESS
        )
          .then((ix) =>
            web3.sendAndConfirmTransaction(
              connection,
              new web3.Transaction().add(ix),
              [payer]
            )
          )
          .catch((reason) => {
            expect(errorExistsInLog(reason, "already in use")).is.true;
            return null;
          });
        expect(initializeTx).is.null;
      });
    });
  });

  describe("Register Foreign Emitter", () => {
    describe("Fuzz Test Invalid Accounts for Instruction: register_emitter", () => {
      // program interface
      const program = createHelloWorldProgramInterface(
        connection,
        HELLO_WORLD_ADDRESS
      );

      const emitterChain = foreignEmitterChain;
      const emitterAddress = foreignEmitterAddress;

      it("Invalid Account: owner", async () => {
        const nonOwners = [];

        for (let i = 0; i < FUZZ_TEST_ITERATIONS; ++i) {
          nonOwners.push(web3.Keypair.generate());
        }

        // Airdrop funds for these a-holes
        await Promise.all(
          nonOwners.map(async (nonOwner) => {
            await connection
              .requestAirdrop(nonOwner.publicKey, 69 * web3.LAMPORTS_PER_SOL)
              .then((tx) => connection.confirmTransaction(tx));
          })
        );

        for (let i = 0; i < FUZZ_TEST_ITERATIONS; ++i) {
          const nonOwner = nonOwners[i];

          const registerForeignEmitterTx = await program.methods
            .registerEmitter(emitterChain, [...emitterAddress])
            .accounts({
              owner: nonOwner.publicKey,
              config: realConfig,
              foreignEmitter: realForeignEmitter,
            })
            .instruction()
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [nonOwner]
              )
            )
            .catch((reason) => {
              expect(errorExistsInLog(reason, "OwnerOnly")).is.true;
              return null;
            });
          expect(registerForeignEmitterTx).is.null;
        }
      });

      it("Invalid Account: config", async () => {
        const possibleConfigs: web3.PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleConfigs.push(
              web3.PublicKey.createProgramAddressSync(
                [Buffer.from("config"), bumpBytes],
                HELLO_WORLD_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(possibleConfigs.shift()!.equals(realConfig)).is.true;

        for (const config of possibleConfigs) {
          const registerForeignEmitterTx = await program.methods
            .registerEmitter(emitterChain, [...emitterAddress])
            .accounts({
              owner: payer.publicKey,
              config,
              foreignEmitter: realForeignEmitter,
            })
            .instruction()
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "The program expected this account to be already initialized"
                )
              ).is.true;
              return null;
            });
          expect(registerForeignEmitterTx).is.null;
        }
      });

      it("Invalid Account: foreign_emitter", async () => {
        const possibleForeignEmitters: web3.PublicKey[] = [];
        for (let i = 255; i >= 0; --i) {
          const bumpBytes = Buffer.alloc(1);
          bumpBytes.writeUint8(i);
          try {
            possibleForeignEmitters.push(
              web3.PublicKey.createProgramAddressSync(
                [
                  Buffer.from("foreign_emitter"),
                  (() => {
                    const buf = Buffer.alloc(2);
                    buf.writeUInt16LE(foreignEmitterChain);
                    return buf;
                  })(),
                  bumpBytes,
                ],
                HELLO_WORLD_ADDRESS
              )
            );
          } catch (reason) {
            // do nothing
          }
        }
        expect(possibleForeignEmitters.shift()!.equals(realForeignEmitter)).is
          .true;

        // First pass completely bogus PDAs
        for (const foreignEmitter of possibleForeignEmitters) {
          const registerForeignEmitterTx = await program.methods
            .registerEmitter(emitterChain, [...emitterAddress])
            .accounts({
              owner: payer.publicKey,
              config: realConfig,
              foreignEmitter,
            })
            .instruction()
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "Cross-program invocation with unauthorized signer or writable account"
                )
              ).is.true;
              return null;
            });
          expect(registerForeignEmitterTx).is.null;
        }

        // Now try to pass PDAs that do not agree with chain from instruction data
        {
          const bogusEmitterChain = emitterChain + 1;

          const registerForeignEmitterTx = await program.methods
            .registerEmitter(bogusEmitterChain, [...emitterAddress])
            .accounts({
              owner: payer.publicKey,
              config: realConfig,
              foreignEmitter: realForeignEmitter,
            })
            .instruction()
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "Cross-program invocation with unauthorized signer or writable account"
                )
              ).is.true;
              return null;
            });
          expect(registerForeignEmitterTx).is.null;
        }

        // Now try to pass emitter address with length != 32 bytes
        {
          const bogusEmitterAddress = Buffer.alloc(20, "deadbeef", "hex");
          const registerForeignEmitterTx = await program.methods
            .registerEmitter(emitterChain, [...bogusEmitterAddress])
            .accounts({
              owner: payer.publicKey,
              config: realConfig,
              foreignEmitter: realForeignEmitter,
            })
            .instruction()
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              expect(
                errorExistsInLog(
                  reason,
                  "The program could not deserialize the given instruction"
                )
              ).is.true;
              return null;
            });
          expect(registerForeignEmitterTx).is.null;
        }

        // Now try to pass zero emitter address
        {
          const bogusEmitterAddress = Buffer.alloc(32);
          const registerForeignEmitterTx = await program.methods
            .registerEmitter(emitterChain, [...bogusEmitterAddress])
            .accounts({
              owner: payer.publicKey,
              config: realConfig,
              foreignEmitter: realForeignEmitter,
            })
            .instruction()
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              expect(errorExistsInLog(reason, "InvalidForeignEmitter")).to.be
                .true;
              return null;
            });
          expect(registerForeignEmitterTx).is.null;
        }
      });
    });

    describe("Finally Register Foreign Emitter", () => {
      it("Instruction: register_emitter", async () => {
        const emitterChain = foreignEmitterChain;
        const emitterAddress = Buffer.alloc(32, "fbadc0de", "hex");

        const registerForeignEmitterTx =
          await createRegisterForeignEmitterInstruction(
            connection,
            HELLO_WORLD_ADDRESS,
            payer.publicKey,
            emitterChain,
            emitterAddress
          )
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              // should not happen
              console.log(reason);
              return null;
            });
        expect(registerForeignEmitterTx).is.not.null;

        // verify account data
        const foreignEmitterData = await getForeignEmitterData(
          connection,
          HELLO_WORLD_ADDRESS,
          emitterChain
        );
        expect(foreignEmitterData.chain).to.equal(emitterChain);
        expect(
          Buffer.compare(emitterAddress, foreignEmitterData.address)
        ).to.equal(0);
      });

      it("Call Instruction Again With Different Emitter Address", async () => {
        const emitterChain = foreignEmitterChain;
        const emitterAddress = foreignEmitterAddress;

        const registerForeignEmitterTx =
          await createRegisterForeignEmitterInstruction(
            connection,
            HELLO_WORLD_ADDRESS,
            payer.publicKey,
            emitterChain,
            emitterAddress
          )
            .then((ix) =>
              web3.sendAndConfirmTransaction(
                connection,
                new web3.Transaction().add(ix),
                [payer]
              )
            )
            .catch((reason) => {
              // should not happen
              console.log(reason);
              return null;
            });
        expect(registerForeignEmitterTx).is.not.null;

        // verify account data
        const foreignEmitterData = await getForeignEmitterData(
          connection,
          HELLO_WORLD_ADDRESS,
          emitterChain
        );
        expect(foreignEmitterData.chain).to.equal(emitterChain);
        expect(
          Buffer.compare(emitterAddress, foreignEmitterData.address)
        ).to.equal(0);
      });
    });
  });

  describe("Send Message", () => {
    describe("Finally Send Message", () => {
      const helloMessage = Buffer.from("All your base are belong to us");

      it("Instruction: send_message", async () => {
        // save message count to grab posted message later
        const sequence = await getProgramSequenceTracker(
          connection,
          HELLO_WORLD_ADDRESS,
          WORMHOLE_ADDRESS
        ).then((sequenceTracker) => sequenceTracker.value() + 1n);

        const sendMessageTx = await createSendMessageInstruction(
          connection,
          HELLO_WORLD_ADDRESS,
          payer.publicKey,
          WORMHOLE_ADDRESS,
          helloMessage
        )
          .then((ix) =>
            web3.sendAndConfirmTransaction(
              connection,
              new web3.Transaction().add(ix),
              [payer]
            )
          )
          .catch((reason) => {
            // should not happen
            console.log(reason);
            return null;
          });
        expect(sendMessageTx).is.not.null;

        // verify account data
        const payload = await getPostedMessage(
          connection,
          deriveWormholeMessageKey(HELLO_WORLD_ADDRESS, sequence)
        ).then((posted) => posted.message.payload);

        expect(payload.readUint8(0)).to.equal(1); // payload ID
        expect(payload.readUint16BE(1)).to.equal(helloMessage.length);
        expect(Buffer.compare(payload.subarray(3), helloMessage)).to.equal(0);
      });
    });
  });

  describe("Receive Message", () => {
    const emitter = new MockEmitter(
      foreignEmitterAddress.toString("hex"),
      foreignEmitterChain
    );

    const guardians = new MockGuardians(0, [GUARDIAN_PRIVATE_KEY]);

    const batchId = 0;
    const message = Buffer.from("Somebody set up us the bomb");
    const wormholePayload = (() => {
      const buf = Buffer.alloc(3 + message.length);
      buf.writeUint8(1, 0);
      buf.writeUint16BE(message.length, 1);
      buf.write(message.toString(), 3);
      return buf;
    })();

    describe("Finally Receive Message", () => {
      const finality = 1;
      const published = emitter.publishMessage(
        batchId,
        wormholePayload,
        finality
      );

      const signedWormholeMessage = guardians.addSignatures(published, [0]);

      it("Post Wormhole Message", async () => {
        const response = await postVaaSolana(
          connection,
          new NodeWallet(payer).signTransaction,
          WORMHOLE_ADDRESS,
          payer.publicKey,
          signedWormholeMessage
        ).catch((reason) => null);
        expect(response).is.not.null;
      });

      it("Instruction: receive_message", async () => {
        const receiveMessageTx = await createReceiveMessageInstruction(
          connection,
          HELLO_WORLD_ADDRESS,
          payer.publicKey,
          WORMHOLE_ADDRESS,
          signedWormholeMessage
        )
          .then((ix) =>
            web3.sendAndConfirmTransaction(
              connection,
              new web3.Transaction().add(ix),
              [payer]
            )
          )
          .catch((reason) => {
            // should not happen
            console.log(reason);
            return null;
          });
        expect(receiveMessageTx).is.not.null;

        const parsed = parseVaa(signedWormholeMessage);
        const received = await getReceivedData(
          connection,
          HELLO_WORLD_ADDRESS,
          parsed.emitterChain,
          parsed.sequence
        );
        expect(received.batchId).to.equal(batchId);
        expect(Buffer.compare(received.message, message)).to.equal(0);
      });

      it("Cannot Call Instruction Again With Same Wormhole Message: receive_message", async () => {
        const receiveMessageTx = await createReceiveMessageInstruction(
          connection,
          HELLO_WORLD_ADDRESS,
          payer.publicKey,
          WORMHOLE_ADDRESS,
          signedWormholeMessage
        )
          .then((ix) =>
            web3.sendAndConfirmTransaction(
              connection,
              new web3.Transaction().add(ix),
              [payer]
            )
          )
          .catch((reason) => {
            expect(errorExistsInLog(reason, "already in use")).to.be.true;
            return null;
          });
        expect(receiveMessageTx).is.null;
      });
    });
  });
});
