import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { spawn } from 'child_process';
import { validateISPMatch, detectCurrentISP } from '@/lib/speedtest';
import { normalizeISPName, resolveISPFromId } from '@/lib/isp-utils';
import { getCurrentTimeSlotForTimezone, getCurrentTimeSlot } from '@/lib/timezone';
import { TimeSlot } from '@prisma/client';

// Track active speedtest requests
const activeRequests = new Set<string>();

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  // Track this request
  activeRequests.add(requestId);
  console.log(`🚀 [${requestId}] Speed test request started at ${new Date().toISOString()}`);
  console.log(`📊 [${requestId}] Active concurrent requests: ${activeRequests.size}`);

  // Cleanup function
  const cleanup = () => {
    activeRequests.delete(requestId);
    console.log(
      `🧹 [${requestId}] Request cleaned up. Remaining active requests: ${activeRequests.size}`
    );
  };

  const session = await getServerSession(authOptions);

  if (!session) {
    console.log(`❌ [${requestId}] Unauthorized request - no session`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }  const { searchParams } = new URL(request.url);
  const officeId = searchParams.get('officeId');
  const selectedISP = searchParams.get('selectedISP');
  const selectedSection = searchParams.get('selectedSection');
  const useValidatedISP = searchParams.get('useValidatedISP') === 'true';
  const timezone = searchParams.get('timezone') || 'UTC';

  console.log(`🔗 [${requestId}] Full request URL: ${request.url}`);
  console.log(
    `📋 [${requestId}] Parsed params - Office ID: ${officeId}, Selected ISP: ${selectedISP}, Selected Section: ${selectedSection}, Use Validated ISP: ${useValidatedISP}, Timezone: ${timezone}`
  );

  // Check permissions
  if (session.user?.role !== 'ADMIN' && session.user?.officeId !== officeId) {
    console.log(
      `🚫 [${requestId}] Forbidden - user office ${session.user?.officeId} doesn't match requested ${officeId}`
    );
    cleanup();
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Always use client timezone for time slot detection, ignore server time
  let currentTimeSlot: TimeSlot | null = null;
  
  if (timezone && timezone !== 'UTC') {
    // Prioritize client timezone
    currentTimeSlot = getCurrentTimeSlotForTimezone(timezone);
    console.log(`⏰ [${requestId}] Using client timezone (${timezone}) for validation: ${currentTimeSlot}`);
  } 
  
  // Only fallback to server timezone if client timezone fails completely  
  if (!currentTimeSlot && (!timezone || timezone === 'UTC')) {
    currentTimeSlot = getCurrentTimeSlot();
    console.log(`⏰ [${requestId}] Using server timezone as fallback: ${currentTimeSlot}`);
  }

  if (!currentTimeSlot) {
    console.log(`⏰ [${requestId}] Speed test blocked - outside testing hours (timezone: ${timezone})`);
    cleanup();
    return NextResponse.json({ 
      error: 'Testing is only allowed during designated time slots (6AM-11:59AM, 12PM-12:59PM, 1PM-6PM)',
      currentTime: new Date().toISOString(),
      timezone: timezone,
      message: 'Using your local time for validation'
    }, { status: 400 });
  }

  console.log(`✅ [${requestId}] Time slot validation passed - current slot: ${currentTimeSlot} (timezone: ${timezone})`);
  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  console.log(`📡 [${requestId}] SSE headers configured, starting stream`);

  const encoder = new TextEncoder();
  let isTestComplete = false;
  let isControllerClosed = false;
  let testStartTime: number;  const stream = new ReadableStream({
    async start(controller) {
      // Only detect ISP if not using validated ISP from pre-validation
      let initialDetectedISP: string | null = null;
      if (!useValidatedISP) {
        try {
          console.log(`🌐 [${requestId}] Detecting initial ISP for preservation...`);
          initialDetectedISP = await detectCurrentISP();
          console.log(`🌐 [${requestId}] Initial ISP detected: "${initialDetectedISP}"`);
        } catch (error) {
          console.log(`⚠️ [${requestId}] Failed to detect initial ISP:`, error);
        }
      } else {
        // Use the selected ISP as the validated ISP (it was already validated in pre-validation)
        initialDetectedISP = selectedISP;
        console.log(`🌐 [${requestId}] Using validated ISP from pre-validation: "${initialDetectedISP}"`);
      }

      const safeEnqueue = (data: string) => {
        if (!isControllerClosed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (error) {
            console.log(`⚠️ [${requestId}] Error enqueueing data:`, error);
            isControllerClosed = true;
          }
        }
      };
      const safeClose = () => {
        if (!isControllerClosed) {
          try {
            const duration = Date.now() - startTime;
            console.log(`🏁 [${requestId}] Closing stream after ${duration}ms`);
            controller.close();
            isControllerClosed = true;
            cleanup(); // Clean up tracking
          } catch (error) {
            console.log(`⚠️ [${requestId}] Error closing controller:`, error);
            isControllerClosed = true;
            cleanup(); // Clean up tracking even on error
          }
        }
      }; // Send initial connection message
      console.log(`📤 [${requestId}] Sending initial connection message`);
      safeEnqueue(
        `data: ${JSON.stringify({
          type: 'progress',
          stage: 'connecting',
          progress: 5,
          download: 0,
          upload: 0,
          ping: 0,
        })}\n\n`
      );

      // Run REAL speedtest with progress updates
      console.log(`⚡ [${requestId}] Starting speedtest CLI process`);
      testStartTime = Date.now();
      const speedtest = spawn('speedtest', [
        '--format=json',
        '--accept-license',
        '--accept-gdpr',
        '--progress=yes',
        '--progress-update-interval=250',
        '--server-id=10493', // Use PLDT Lucena City server that works
      ]);
      console.log(`🔧 [${requestId}] Speedtest process spawned with PID: ${speedtest.pid}`);

      // Set up timeout to prevent hanging tests (5 minutes max)
      const testTimeout = setTimeout(() => {
        if (!isTestComplete) {
          console.log(`⏰ [${requestId}] Speed test timeout after 5 minutes, terminating`);
          hasError = true;
          safeEnqueue(
            `data: ${JSON.stringify({
              type: 'error',
              error: 'Speed test timed out after 5 minutes. Please try again.',
            })}\n\n`
          );
          speedtest.kill('SIGTERM');
          setTimeout(() => {
            if (!speedtest.killed) {
              speedtest.kill('SIGKILL');
            }
          }, 5000);
        }
      }, 300000); // 5 minutes

      let fullOutput = '';
      let currentDownload = 0;
      let currentUpload = 0;
      let currentPing = 0;
      let hasError = false;
      let progressCount = 0;
      let hasSavedToDatabase = false; // Flag to prevent duplicate database saves

      speedtest.stdout.on('data', data => {
        if (isControllerClosed) return;

        const chunk = data.toString();
        fullOutput += chunk;
        progressCount++;

        const elapsed = Date.now() - testStartTime;
        console.log(
          `📊 [${requestId}] Progress ${progressCount} at ${elapsed}ms - received ${chunk.length} bytes`
        );

        // Parse each line as potential JSON
        const lines = chunk.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('{')) {
            try {
              const result = JSON.parse(trimmedLine);
              console.log(`[${requestId}] Parsed JSON result type: ${result.type || 'unknown'}`);

              // Handle error messages from speedtest
              if (result.error) {
                console.error(`🚨 [${requestId}] Speedtest CLI error:`, result.error);
                hasError = true;
                safeEnqueue(
                  `data: ${JSON.stringify({
                    type: 'error',
                    error: `Speedtest error: ${result.error}`,
                  })}\n\n`
                );
                speedtest.kill();
                return;
              } // Handle different types of progress updates with precise progress tracking
              if (result.type === 'testStart') {
                console.log(`🎬 [${requestId}] Test started - sending initial progress`);

                safeEnqueue(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    stage: 'connecting',
                    progress: 5, // Initial connection progress
                    download: 0,
                    upload: 0,
                    ping: 0,
                  })}\n\n`
                );
              } else if (result.type === 'ping') {
                // Ping phase: 5% -> 25% (20% range)
                const pingProgressPercent = Math.max(0, Math.min(1, result.ping.progress || 0)); // Ensure 0-1 range
                const overallProgress = 5 + pingProgressPercent * 20; // 5-25%
                currentPing = Math.max(0, result.ping.latency || 0);

                console.log(
                  `🏓 [${requestId}] Ping phase: ${(pingProgressPercent * 100).toFixed(1)}% (${overallProgress.toFixed(1)}% overall) - ${currentPing.toFixed(1)}ms`
                );

                const pingData = {
                  type: 'progress',
                  stage: 'ping',
                  progress: overallProgress,
                  download: 0,
                  upload: 0,
                  ping: currentPing,
                };
                safeEnqueue(`data: ${JSON.stringify(pingData)}\n\n`);
              } else if (result.type === 'download') {
                // Download phase: 25% -> 65% (40% range)
                const downloadProgressPercent = Math.max(
                  0,
                  Math.min(1, result.download.progress || 0)
                ); // Ensure 0-1 range
                const overallProgress = 25 + downloadProgressPercent * 40; // 25-65%
                currentDownload = Math.max(0, (result.download.bandwidth * 8) / 1000000); // Convert to Mbps, ensure positive

                console.log(
                  `⬇️ [${requestId}] Download phase: ${(downloadProgressPercent * 100).toFixed(1)}% (${overallProgress.toFixed(1)}% overall) - ${currentDownload.toFixed(1)} Mbps`
                );

                const downloadData = {
                  type: 'progress',
                  stage: 'download',
                  progress: overallProgress,
                  download: currentDownload,
                  upload: 0,
                  ping: currentPing,
                };
                safeEnqueue(`data: ${JSON.stringify(downloadData)}\n\n`);
              } else if (result.type === 'upload') {
                // Upload phase: 65% -> 95% (30% range)
                const uploadProgressPercent = Math.max(0, Math.min(1, result.upload.progress || 0)); // Ensure 0-1 range
                const overallProgress = 65 + uploadProgressPercent * 30; // 65-95%

                // Fix negative bandwidth issue and ensure positive values
                let uploadBandwidth = result.upload.bandwidth || 0;
                if (uploadBandwidth < 0 || uploadBandwidth > 1e15 || !isFinite(uploadBandwidth)) {
                  // Handle invalid bandwidth values
                  uploadBandwidth = 0;
                }
                currentUpload = Math.max(0, (uploadBandwidth * 8) / 1000000); // Convert to Mbps, ensure positive

                console.log(
                  `⬆️ [${requestId}] Upload phase: ${(uploadProgressPercent * 100).toFixed(1)}% (${overallProgress.toFixed(1)}% overall) - ${currentUpload.toFixed(1)} Mbps`
                );

                const uploadData = {
                  type: 'progress',
                  stage: 'upload',
                  progress: overallProgress,
                  download: currentDownload,
                  upload: currentUpload,
                  ping: currentPing,
                };
                safeEnqueue(`data: ${JSON.stringify(uploadData)}\n\n`);
              } else if (result.type === 'result') {
                // Final results - ensure test completion

                console.log(`🌐 [${requestId}] ISP from result:`, result.isp);
                console.log(`🌐 [${requestId}] Interface from result:`, result.interface);

                const finalDownload = (result.download?.bandwidth * 8) / 1000000 || 0;
                const finalUpload = (result.upload?.bandwidth * 8) / 1000000 || 0;
                const finalPing = result.ping?.latency || 0;
                const testDuration = Date.now() - testStartTime;
                console.log(
                  `🎯 [${requestId}] Final results after ${testDuration}ms: Download ${finalDownload.toFixed(1)}Mbps, Upload ${finalUpload.toFixed(1)}Mbps, Ping ${finalPing.toFixed(1)}ms`
                );

                // Log Ookla shareable URL if available
                if (result.result?.url) {
                  console.log(`🔗 [${requestId}] Ookla Result URL: ${result.result.url}`);
                }                // Store final result for database save
                // Use the initially detected ISP instead of Ookla's detection to maintain consistency
                let detectedISP: string;
                
                if (useValidatedISP && selectedISP) {
                  // Use the selected ISP that was already validated in pre-validation
                  detectedISP = selectedISP;
                  console.log(`🌐 [${requestId}] Using validated selected ISP: "${selectedISP}"`);
                } else {
                  // Fallback to initial detection or Ookla detection
                  detectedISP = initialDetectedISP || 
                    result.isp ||
                    result.interface?.externalIsp ||
                    result.client?.isp ||
                    'Unknown ISP';
                  console.log(`🌐 [${requestId}] Using initial detected ISP: "${initialDetectedISP}"`);
                }
                
                console.log(`🌐 [${requestId}] Ookla detected ISP: "${result.isp}"`);
                console.log(`🌐 [${requestId}] Final ISP used: "${detectedISP}"`);

                // Validate ISP if selectedISP is provided (but skip if using validated ISP)
                let ispValidation;
                if (selectedISP && !useValidatedISP) {
                  // Only validate if we're not using the already-validated ISP
                  ispValidation = validateISPMatch(selectedISP, detectedISP);
                  console.log(`🔍 [${requestId}] ISP validation result:`, ispValidation);
                } else if (useValidatedISP) {
                  // Create a successful validation result since it was already validated
                  ispValidation = {
                    isMatch: true,
                    confidence: 100,
                    detectedCanonical: normalizeISPName(detectedISP),
                    selectedCanonical: normalizeISPName(selectedISP!),
                    allowProceed: true
                  };
                  console.log(`✅ [${requestId}] Using pre-validated ISP, skipping re-validation`);
                }

                const finalResult = {
                  download: finalDownload,
                  upload: finalUpload,
                  ping: finalPing,
                  jitter: result.ping?.jitter || 0,
                  packetLoss: result.packetLoss || 0,
                  serverId: result.server?.id?.toString(),
                  serverName: result.server?.name,
                  ispName: detectedISP,
                  ispValidation, // Include ISP validation results
                  rawData: JSON.stringify(result),
                };

                // Send final result with exactly 100% progress
                console.log(`📤 [${requestId}] Sending final results to client`);
                safeEnqueue(
                  `data: ${JSON.stringify({
                    type: 'result',
                    stage: 'complete',
                    progress: 100,
                    download: finalDownload,
                    upload: finalUpload,
                    ping: finalPing,
                    jitter: result.ping?.jitter || 0,
                    packetLoss: result.packetLoss || 0,
                    serverId: result.server?.id?.toString(),
                    serverName: result.server?.name,
                    ispName: detectedISP,
                    ispValidation, // Include ISP validation results
                    clientIp: result.interface?.externalIp || 'Unknown',
                    serverLocation: result.server?.location || 'Unknown',
                    resultUrl: result.result?.url, // Add Ookla result URL
                    complete: true,
                    rawData: JSON.stringify(result),
                  })}\n\n`
                );
                isTestComplete = true;
                clearTimeout(testTimeout); // Clear timeout since test completed

                // Prevent duplicate database saves
                if (hasSavedToDatabase) {
                  console.log(
                    `⚠️ [${requestId}] Database save already completed, skipping duplicate save`
                  );
                  safeClose();
                  return;
                }
                hasSavedToDatabase = true;

                // Save to database immediately and await it
                console.log(`💾 [${requestId}] Initiating database save`);
                (async () => {
                  try {
                    // Get office info to capture ISP at time of test
                    const office = await prisma.office.findUnique({
                      where: { id: officeId! },
                      select: { isp: true, isps: true, sectionISPs: true },
                    });
                    if (!office) {
                      console.error(`❌ [${requestId}] Office not found for ID: ${officeId}`);
                      return;
                    }

                    // Determine which ISP name to save using proper resolution
                    let ispToSave: string;
                    if (selectedISP) {
                      // Try to resolve the ISP ID to get the proper display name
                      const resolvedISP = resolveISPFromId(selectedISP, office);
                      if (resolvedISP) {
                        ispToSave = resolvedISP.displayName;
                        console.log(
                          `🏷️ [${requestId}] Resolved ISP ID "${selectedISP}" to display name: "${ispToSave}"`
                        );
                      } else {
                        // Fallback: treat selectedISP as direct name
                        ispToSave = normalizeISPName(selectedISP);
                        console.log(
                          `🏷️ [${requestId}] Could not resolve ISP ID "${selectedISP}", using as direct name: "${ispToSave}"`
                        );
                      }
                    } else {
                      // No specific ISP selected - use detected ISP from speedtest
                      ispToSave = normalizeISPName(finalResult.ispName || office.isp);
                      console.log(
                        `🏷️ [${requestId}] Using detected ISP: "${finalResult.ispName || office.isp}" -> normalized: "${ispToSave}"`
                      );
                    } // Create enhanced rawData that includes section information
                    const enhancedRawData = {
                      ...result,
                      section: selectedSection || 'General', // Include section information
                      selectedISP: selectedISP, // Include originally selected ISP
                      testMetadata: {
                        requestId: requestId,
                        timestamp: new Date().toISOString(),
                        testDuration: testDuration,
                      },
                    };

                    const speedTest = await prisma.speedTest.create({
                      data: {
                        officeId: officeId!,
                        download: finalResult.download,
                        upload: finalResult.upload,
                        ping: finalResult.ping,
                        jitter: finalResult.jitter,
                        packetLoss: finalResult.packetLoss,
                        isp: ispToSave, // Use normalized ISP name for consistent tracking
                        serverId: finalResult.serverId,
                        serverName: finalResult.serverName,
                        rawData: JSON.stringify(enhancedRawData), // Use enhanced raw data with section info
                      } as any,
                    });
                    console.log(`💾 [${requestId}] Speed test saved to database: ${speedTest.id}`);
                    console.log(
                      `🌐 [${requestId}] Saved ISP: ${ispToSave}, Section: ${selectedSection || 'General'}`
                    );
                  } catch (dbError) {
                    console.error(
                      `❌ [${requestId}] Failed to save speed test to database:`,
                      dbError
                    );
                  }
                })();

                // Close the stream after a short delay
                setTimeout(() => {
                  safeClose();
                }, 500);
              }
            } catch {
              // Ignore JSON parsing errors for malformed lines
            }
          }
        }
      });
      speedtest.stderr.on('data', data => {
        if (isControllerClosed) return;

        const errorText = data.toString();
        console.error(`🚨 [${requestId}] Speedtest stderr:`, errorText);

        if (errorText.includes('No servers') || errorText.includes('Unable to connect')) {
          console.log(`🌐 [${requestId}] Connection error detected`);
          hasError = true;
          safeEnqueue(
            `data: ${JSON.stringify({
              type: 'error',
              error:
                'Unable to connect to speedtest servers. Please check your internet connection.',
            })}\n\n`
          );
          speedtest.kill();
        } else if (errorText.includes('Cannot open socket') || errorText.includes('socket')) {
          console.log(`🔌 [${requestId}] Socket error detected`);
          hasError = true;
          safeEnqueue(
            `data: ${JSON.stringify({
              type: 'error',
              error:
                'Network socket error. This could be due to firewall restrictions or network configuration. Please try again or contact your network administrator.',
              networkError: true,
            })}\n\n`
          );
          speedtest.kill();
        } else if (errorText.includes('Unknown error') || errorText.includes('Error: [0]')) {
          console.log(`❓ [${requestId}] Unknown error detected`);
          hasError = true;
          safeEnqueue(
            `data: ${JSON.stringify({
              type: 'error',
              error:
                'Speedtest CLI encountered an unknown error. This may be temporary - please try again in a few moments.',
              retryable: true,
            })}\n\n`
          );
          speedtest.kill();
        } else if (
          errorText.includes('Protocol error') ||
          errorText.includes('Did not receive HELLO')
        ) {
          console.log(`⚠️ [${requestId}] Protocol error detected but continuing test`);
          // Don't kill the test for protocol errors - these can be transient during upload phase
          // The test might still complete successfully
        }
      });
      speedtest.on('close', code => {
        if (isControllerClosed || hasError) return;

        const testDuration = Date.now() - testStartTime;
        console.log(
          `🔚 [${requestId}] Speedtest process closed with code ${code} after ${testDuration}ms`
        );

        if (code === 0 && !isTestComplete) {
          console.log(
            `[${requestId}] Process completed successfully but no final result received, parsing output`
          );
          try {
            // Parse the final complete JSON result
            const jsonMatch = fullOutput.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);

              // Validate and sanitize bandwidth values
              const downloadBandwidth = result.download?.bandwidth || 0;
              const uploadBandwidth = result.upload?.bandwidth || 0;

              const finalDownload = downloadBandwidth > 0 ? (downloadBandwidth * 8) / 1000000 : 0;
              const finalUpload = uploadBandwidth > 0 ? (uploadBandwidth * 8) / 1000000 : 0;
              const finalResult = {
                type: 'result',
                stage: 'complete',
                progress: 100,
                download: finalDownload,
                upload: finalUpload,
                ping: result.ping?.latency || 0,
                jitter: result.ping?.jitter || 0,
                packetLoss: result.packetLoss || 0,
                serverId: result.server?.id?.toString(),
                serverName: result.server?.name,
                ispName: result.isp || 'Unknown ISP',
                clientIp: result.interface?.externalIp || 'Unknown',
                serverLocation: result.server?.location || 'Unknown',
                resultUrl: result.result?.url, // Add Ookla result URL
                complete: true,
                rawData: JSON.stringify(result),
              };

              console.log(`📊 [${requestId}] Final speed test results (fallback):`, finalResult);
              safeEnqueue(`data: ${JSON.stringify(finalResult)}\n\n`);
              isTestComplete = true;
              // Save to database asynchronously
              setTimeout(async () => {
                try {
                  // Get office info to capture ISP at time of test
                  const office = await prisma.office.findUnique({
                    where: { id: officeId! },
                    select: { isp: true },
                  });

                  if (!office) {
                    console.error(`❌ [${requestId}] Office not found for ID: ${officeId}`);
                    return;
                  }
                  const speedTest = await prisma.speedTest.create({
                    data: {
                      officeId: officeId!,
                      download: finalResult.download,
                      upload: finalResult.upload,
                      ping: finalResult.ping,
                      jitter: finalResult.jitter,
                      packetLoss: finalResult.packetLoss,
                      isp: selectedISP || finalResult.ispName || office.isp, // Use selected ISP first, then detected ISP, then fallback to office ISP
                      serverId: finalResult.serverId,
                      serverName: finalResult.serverName,
                      rawData: finalResult.rawData,
                    } as any,
                  });
                  console.log(
                    `💾 [${requestId}] Speed test saved to database (fallback): ${speedTest.id}`
                  );
                } catch (dbError) {
                  console.error(
                    `❌ [${requestId}] Failed to save speed test to database (fallback):`,
                    dbError
                  );
                }
              }, 100);
            }
          } catch (error) {
            console.error(`❌ [${requestId}] Error parsing final results:`, error);
            safeEnqueue(
              `data: ${JSON.stringify({
                type: 'error',
                error: 'Failed to parse speed test results',
              })}\n\n`
            );
          }
        } else if (!isTestComplete && !hasError) {
          let errorMessage = 'Speed test failed';
          if (code === 1) {
            errorMessage = 'Speedtest CLI error. Please check your internet connection.';
          } else if (code === 2) {
            errorMessage = 'No speedtest servers available. Please try again later.';
          } else {
            errorMessage = `Speed test failed with code: ${code}`;
          }

          console.log(`❌ [${requestId}] Speed test failed with code ${code}: ${errorMessage}`);
          safeEnqueue(
            `data: ${JSON.stringify({
              type: 'error',
              error: errorMessage,
            })}\n\n`
          );
        }

        setTimeout(() => {
          safeClose();
        }, 1000);
      });
      speedtest.on('error', error => {
        if (isControllerClosed) return;

        console.error(`💥 [${requestId}] Speedtest process error:`, error);
        safeEnqueue(
          `data: ${JSON.stringify({
            type: 'error',
            error: error.message,
          })}\n\n`
        );
        safeClose();
      }); // Handle client disconnect
      request.signal?.addEventListener('abort', () => {
        console.log(`🔌 [${requestId}] Client disconnected, terminating speedtest process`);
        isControllerClosed = true;
        speedtest.kill();
        cleanup(); // Clean up tracking on disconnect
      });
    },
  });

  return new Response(stream, { headers });
}
