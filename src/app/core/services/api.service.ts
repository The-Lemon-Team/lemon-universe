import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ArenaActorCard,
  BoardMemberRole,
  BoardPrivacy,
  CloudDayNote,
  CodeRepoView,
  CreateFlowPayload,
  Flow,
  FlowEventRecord,
  FlowMetrics,
  FlowSessionRecord,
  FlowStatus,
  Folder,
  NoteWeatherSnapshot,
  NoteWorldMomentSnapshot,
  PlayerType,
  Profile,
  TimelineBoard,
  TimelineBoardMember,
  TimelineBoardMode,
  TimelineMediaAttachment,
  TimelineNodeCrossRef,
} from '../models/flow.models';

/** Thin typed wrapper over the NestJS REST API (contracts = flow.models.ts). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private profileHeaders(profileId?: string | null): HttpHeaders {
    return profileId ? new HttpHeaders({ 'x-profile-id': profileId }) : new HttpHeaders();
  }

  getProfiles(): Observable<Profile[]> {
    return this.http.get<Profile[]>(`${this.base}/profiles`);
  }

  getActors(opts?: { category?: string; search?: string; tower?: string; isLead?: boolean }): Observable<ArenaActorCard[]> {
    let params = new HttpParams();
    if (opts?.category) params = params.set('category', opts.category);
    if (opts?.search) params = params.set('search', opts.search);
    if (opts?.tower) params = params.set('tower', opts.tower);
    if (opts?.isLead !== undefined) params = params.set('isLead', String(opts.isLead));
    return this.http.get<ArenaActorCard[]>(`${this.base}/actors`, { params });
  }

  getActorById(idOrHandle: string): Observable<ArenaActorCard> {
    return this.http.get<ArenaActorCard>(`${this.base}/actors/${encodeURIComponent(idOrHandle)}`);
  }

  registerProfile(dto: {
    handle: string;
    displayName: string;
    avatarIcon?: string;
    playerType?: PlayerType;
    defaultFeedSlug?: string;
    seasonsUserId?: string;
    seasonsUserKey?: string;
  }): Observable<Profile> {
    return this.http.post<Profile>(`${this.base}/profiles`, dto);
  }

  updateProfileSeasons(
    profileId: string,
    dto: { seasonsUserId?: string | null; seasonsUserKey?: string | null },
  ): Observable<Profile> {
    return this.http.patch<Profile>(`${this.base}/profiles/${profileId}/seasons`, dto);
  }

  getFlows(opts?: { profileId?: string | null; scope?: string }): Observable<Flow[]> {
    let params = new HttpParams();
    if (opts?.profileId) params = params.set('profileId', opts.profileId);
    if (opts?.scope) params = params.set('scope', opts.scope);
    return this.http.get<Flow[]>(`${this.base}/flows`, { params });
  }

  getFlowMetrics(profileId?: string | null): Observable<FlowMetrics> {
    let params = new HttpParams();
    if (profileId) params = params.set('profileId', profileId);
    return this.http.get<FlowMetrics>(`${this.base}/flows/metrics`, { params });
  }

  createFlow(dto: CreateFlowPayload): Observable<Flow> {
    return this.http.post<Flow>(`${this.base}/flows`, dto);
  }

  deleteFlow(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/flows/${id}`);
  }

  updateFlowStatus(id: string, status: FlowStatus): Observable<Flow> {
    return this.http.patch<Flow>(`${this.base}/flows/${id}/status`, { status });
  }

  updateFlow(id: string, dto: Record<string, unknown>): Observable<Flow> {
    return this.http.patch<Flow>(`${this.base}/flows/${id}`, dto);
  }

  getFlowSessions(id: string): Observable<FlowSessionRecord[]> {
    return this.http.get<FlowSessionRecord[]>(`${this.base}/flows/${id}/sessions`);
  }

  getFlowEvents(id: string): Observable<FlowEventRecord[]> {
    return this.http.get<FlowEventRecord[]>(`${this.base}/flows/${id}/events`);
  }

  appendFlowEvent(
    id: string,
    dto: { source?: string; eventType: string; payload?: Record<string, unknown> },
  ): Observable<FlowEventRecord> {
    return this.http.post<FlowEventRecord>(`${this.base}/flows/${id}/events`, dto);
  }

  getFolders(opts?: { profileId?: string | null; scope?: string }): Observable<Folder[]> {
    let params = new HttpParams();
    if (opts?.profileId) params = params.set('profileId', opts.profileId);
    if (opts?.scope) params = params.set('scope', opts.scope);
    return this.http.get<Folder[]>(`${this.base}/folders`, { params });
  }

  createFolder(dto: { name: string; parentId?: string | null; profileId?: string | null }): Observable<Folder> {
    return this.http.post<Folder>(`${this.base}/folders`, dto);
  }

  /* Code Tasks Endpoints */
  getCodeRepos(profileId?: string | null): Observable<CodeRepoView[]> {
    let params = new HttpParams();
    if (profileId) params = params.set('profileId', profileId);
    return this.http.get<CodeRepoView[]>(`${this.base}/code-tasks/repos`, { params });
  }

  registerCodeRepo(dto: {
    localPath: string;
    name?: string;
    defaultTags?: string[];
    profileId?: string | null;
  }): Observable<CodeRepoView> {
    return this.http.post<CodeRepoView>(`${this.base}/code-tasks/repos`, dto);
  }

  unregisterCodeRepo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/code-tasks/repos/${id}`);
  }

  syncCodeRepo(id: string): Observable<{ syncedTasks: number; updatedResults: number }> {
    return this.http.post<{ syncedTasks: number; updatedResults: number }>(
      `${this.base}/code-tasks/repos/${id}/sync`,
      {},
    );
  }

  pushCodeResults(id: string, payload: any): Observable<{ processed: number }> {
    return this.http.post<{ processed: number }>(`${this.base}/code-tasks/repos/${id}/results`, payload);
  }

  /* TimeLine Boards, Members, Cross-Links & Lemon Seasons Bridge Endpoints */
  getTimelineBoards(profileId?: string | null): Observable<TimelineBoard[]> {
    return this.http.get<TimelineBoard[]>(`${this.base}/timelines/boards`, {
      headers: this.profileHeaders(profileId),
    });
  }

  createTimelineBoard(
    dto: Partial<TimelineBoard> & { memberProfileIds?: string[] },
    profileId?: string | null,
  ): Observable<TimelineBoard> {
    return this.http.post<TimelineBoard>(`${this.base}/timelines/boards`, dto, {
      headers: this.profileHeaders(profileId),
    });
  }

  updateTimelineBoard(
    boardId: string,
    dto: {
      title?: string;
      description?: string;
      icon?: string;
      colorTheme?: string;
      vibeId?: string;
      boardMode?: TimelineBoardMode;
      privacy?: BoardPrivacy;
      defaultActorId?: string | null;
      seasonsFeedSlug?: string;
      isArchived?: boolean;
    },
    profileId?: string | null,
  ): Observable<TimelineBoard> {
    return this.http.patch<TimelineBoard>(`${this.base}/timelines/boards/${boardId}`, dto, {
      headers: this.profileHeaders(profileId),
    });
  }

  deleteTimelineBoard(boardId: string, profileId?: string | null): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(
      `${this.base}/timelines/boards/${boardId}`,
      { headers: this.profileHeaders(profileId) },
    );
  }

  getBoardMembers(boardId: string, profileId?: string | null): Observable<TimelineBoardMember[]> {
    return this.http.get<TimelineBoardMember[]>(`${this.base}/timelines/boards/${boardId}/members`, {
      headers: this.profileHeaders(profileId),
    });
  }

  upsertBoardMember(
    boardId: string,
    dto: { profileId: string; role?: BoardMemberRole; canPost?: boolean; canCrossLink?: boolean },
    actorProfileId?: string | null,
  ): Observable<TimelineBoardMember[]> {
    return this.http.post<TimelineBoardMember[]>(
      `${this.base}/timelines/boards/${boardId}/members`,
      dto,
      { headers: this.profileHeaders(actorProfileId) },
    );
  }

  removeBoardMember(
    boardId: string,
    targetProfileId: string,
    actorProfileId?: string | null,
  ): Observable<TimelineBoardMember[]> {
    return this.http.delete<TimelineBoardMember[]>(
      `${this.base}/timelines/boards/${boardId}/members/${targetProfileId}`,
      { headers: this.profileHeaders(actorProfileId) },
    );
  }

  listProjectariumLinks(actorProfileId?: string | null, standSlug?: string): Observable<any[]> {
    let params = new HttpParams();
    if (standSlug) params = params.set('standSlug', standSlug);
    return this.http.get<any[]>(`${this.base}/timelines/projectarium/links`, {
      params,
      headers: this.profileHeaders(actorProfileId),
    });
  }

  createProjectariumLink(
    dto: {
      standSlug: string;
      boardIds: string[];
      scopes?: ('chronicle:read' | 'chronicle:write')[];
      label?: string;
      projectariumUrl?: string;
    },
    actorProfileId?: string | null,
  ): Observable<any> {
    return this.http.post<any>(`${this.base}/timelines/projectarium/links`, dto, {
      headers: this.profileHeaders(actorProfileId),
    });
  }

  rotateProjectariumLink(linkId: string, actorProfileId?: string | null): Observable<any> {
    return this.http.post<any>(
      `${this.base}/timelines/projectarium/links/${linkId}/rotate`,
      {},
      { headers: this.profileHeaders(actorProfileId) },
    );
  }

  revokeProjectariumLink(linkId: string, actorProfileId?: string | null): Observable<any> {
    return this.http.delete<any>(`${this.base}/timelines/projectarium/links/${linkId}`, {
      headers: this.profileHeaders(actorProfileId),
    });
  }

  getTimelineNotes(
    opts?: string | { boardId?: string; dateKey?: string; actorId?: string; search?: string; tag?: string; profileId?: string | null },
  ): Observable<CloudDayNote[]> {
    const options = typeof opts === 'string' ? { boardId: opts } : opts || {};
    let params = new HttpParams();
    if (options.boardId) params = params.set('boardId', options.boardId);
    if (options.dateKey) params = params.set('dateKey', options.dateKey);
    if (options.actorId) params = params.set('actorId', options.actorId);
    if (options.search) params = params.set('search', options.search);
    if (options.tag) params = params.set('tag', options.tag);
    return this.http.get<CloudDayNote[]>(`${this.base}/timelines/notes`, {
      params,
      headers: this.profileHeaders(options.profileId),
    });
  }

  getTimelineNoteById(
    noteId: string,
    profileId?: string | null,
  ): Observable<CloudDayNote & { boardSlug?: string }> {
    return this.http.get<CloudDayNote & { boardSlug?: string }>(
      `${this.base}/timelines/notes/${encodeURIComponent(noteId)}`,
      { headers: this.profileHeaders(profileId) },
    );
  }

  createTimelineNote(note: CloudDayNote, profileId?: string | null): Observable<CloudDayNote> {
    return this.http.post<CloudDayNote>(`${this.base}/timelines/notes`, note, {
      headers: this.profileHeaders(profileId),
    });
  }

  updateTimelineNote(
    noteId: string,
    dto: {
      title?: string;
      text?: string;
      type?: CloudDayNote['type'];
      moodEmoji?: string;
      tags?: string[];
      mediaAttachments?: TimelineMediaAttachment[];
      weather?: NoteWeatherSnapshot | null;
      worldMoment?: NoteWorldMomentSnapshot | null;
    },
    profileId?: string | null,
  ): Observable<CloudDayNote> {
    return this.http.patch<CloudDayNote>(`${this.base}/timelines/notes/${noteId}`, dto, {
      headers: this.profileHeaders(profileId),
    });
  }

  pinTimelineNote(
    noteId: string,
    isPinned: boolean,
    profileId?: string | null,
  ): Observable<CloudDayNote> {
    return this.http.patch<CloudDayNote>(
      `${this.base}/timelines/notes/${noteId}/pin`,
      { isPinned },
      { headers: this.profileHeaders(profileId) },
    );
  }

  syncNoteToSeasons(
    noteId: string,
    profileId?: string | null,
  ): Observable<{
    noteId: string;
    synced: boolean;
    seasonsNoteId?: string;
    seasonsExternalId?: string;
    seasonsAccountId?: string;
    seasonsSyncedAt?: string;
    error?: string;
  }> {
    return this.http.post<{
      noteId: string;
      synced: boolean;
      seasonsNoteId?: string;
      seasonsExternalId?: string;
      seasonsAccountId?: string;
      seasonsSyncedAt?: string;
      error?: string;
    }>(`${this.base}/timelines/notes/${noteId}/sync-seasons`, {}, {
      headers: this.profileHeaders(profileId),
    });
  }

  shareNoteWithBoardGroup(
    noteId: string,
    dto: { shared?: boolean; granteeProfileIds?: string[] },
    profileId?: string | null,
  ): Observable<{
    noteId: string;
    boardId: string;
    sharedWithGroup: boolean;
    seasonsNoteId?: string;
    sharedCount: number;
  }> {
    return this.http.post<{
      noteId: string;
      boardId: string;
      sharedWithGroup: boolean;
      seasonsNoteId?: string;
      sharedCount: number;
    }>(`${this.base}/timelines/notes/${noteId}/share`, dto, {
      headers: this.profileHeaders(profileId),
    });
  }

  deleteTimelineNote(noteId: string, profileId?: string | null): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(
      `${this.base}/timelines/notes/${noteId}`,
      { headers: this.profileHeaders(profileId) },
    );
  }

  getCrossLinkCandidates(sourceBoardId: string, profileId?: string | null): Observable<CloudDayNote[]> {
    const params = new HttpParams().set('sourceBoardId', sourceBoardId);
    return this.http.get<CloudDayNote[]>(`${this.base}/timelines/cross-links/candidates`, {
      params,
      headers: this.profileHeaders(profileId),
    });
  }

  createCrossLink(
    dto: {
      sourceBoardId?: string;
      sourceNoteId: string;
      targetBoardId: string;
      targetNoteId: string;
      relationLabel?: string;
      previewCache?: TimelineNodeCrossRef;
    },
    profileId?: string | null,
  ): Observable<TimelineNodeCrossRef> {
    return this.http.post<TimelineNodeCrossRef>(`${this.base}/timelines/cross-links`, dto, {
      headers: this.profileHeaders(profileId),
    });
  }

  postAgentSummary(dto: {
    agentProfileId?: string;
    sourceBoardId?: string;
    targetBoardId?: string;
    targetNoteId?: string;
    actorId?: string;
    title?: string;
    text: string;
    dateKey?: string;
    time?: string;
    tags?: string[];
    relationLabel?: string;
  }): Observable<{ summaryNote: CloudDayNote; crossLink: TimelineNodeCrossRef | null }> {
    return this.http.post<{ summaryNote: CloudDayNote; crossLink: TimelineNodeCrossRef | null }>(
      `${this.base}/timelines/agent/summary`,
      dto,
    );
  }

  uploadSeasonsMedia(payload: {
    filename: string;
    mimeType: string;
    dataBase64: string;
    caption?: string;
    boardPrivacy?: BoardPrivacy;
    authorProfileId?: string;
    folderPath?: string;
    tags?: string[];
  }): Observable<{ uploadedToHub: boolean; attachment: TimelineMediaAttachment }> {
    return this.http.post<{ uploadedToHub: boolean; attachment: TimelineMediaAttachment }>(
      `${this.base}/seasons-bridge/media`,
      payload,
    );
  }

  getSeasonsFeedNotes(opts?: {
    feedSlug?: string;
    profileId?: string | null;
    limit?: number;
  }): Observable<{
    synced: boolean;
    seasonsAccountId?: string;
    feedSlug?: string | null;
    items: any[];
    error?: string;
  }> {
    let params = new HttpParams();
    if (opts?.feedSlug) params = params.set('feedSlug', opts.feedSlug);
    if (opts?.limit) params = params.set('limit', String(opts.limit));
    return this.http.get<{
      synced: boolean;
      seasonsAccountId?: string;
      feedSlug?: string | null;
      items: any[];
      error?: string;
    }>(`${this.base}/seasons-bridge/feed`, {
      params,
      headers: this.profileHeaders(opts?.profileId),
    });
  }

  ingestSeasonsNote(payload: Record<string, unknown>): Observable<{
    synced: boolean;
    queuedInPersonalFeed?: boolean;
    noteId?: string;
    feedSlug?: string;
    streamSlug?: string;
  }> {
    return this.http.post<{
      synced: boolean;
      queuedInPersonalFeed?: boolean;
      noteId?: string;
      feedSlug?: string;
      streamSlug?: string;
    }>(`${this.base}/seasons-bridge/ingest`, payload);
  }

  getSeasonsStream(opts?: {
    streamSlug?: string;
    profileId?: string | null;
  }): Observable<{
    connected: boolean;
    stream?: any;
    error?: string;
  }> {
    let params = new HttpParams();
    if (opts?.streamSlug) params = params.set('streamSlug', opts.streamSlug);
    return this.http.get<{
      connected: boolean;
      stream?: any;
      error?: string;
    }>(`${this.base}/seasons-bridge/stream`, {
      params,
      headers: this.profileHeaders(opts?.profileId),
    });
  }

  ensureSeasonsStream(opts?: {
    streamSlug?: string;
    profileId?: string | null;
  }): Observable<{
    success: boolean;
    stream?: any;
    streamSlug: string;
    attachedFeedsCount: number;
    feeds: Array<{ slug: string; title: string; attached: boolean }>;
    error?: string;
  }> {
    return this.http.post<{
      success: boolean;
      stream?: any;
      streamSlug: string;
      attachedFeedsCount: number;
      feeds: Array<{ slug: string; title: string; attached: boolean }>;
      error?: string;
    }>(
      `${this.base}/seasons-bridge/stream/ensure`,
      { streamSlug: opts?.streamSlug },
      { headers: this.profileHeaders(opts?.profileId) },
    );
  }
}
